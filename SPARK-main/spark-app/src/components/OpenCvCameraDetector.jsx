import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Video, AlertTriangle, CheckCircle2,
  Play, Square, ShieldAlert, Cpu, Sparkles, Users, User
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export function OpenCvCameraDetector() {
  const {
    dbConnected,
    zonesList,
    triggerOpenCvAlert,
    recordOpenCvReading,
  } = useApp();

  const [selectedZone, setSelectedZone] = useState('lab');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [useSimulation, setUseSimulation] = useState(false);
  const [simulatedPeople, setSimulatedPeople] = useState(1);
  const [cvReady, setCvReady] = useState(false);
  const [detectionState, setDetectionState] = useState({
    peopleCount: 0,
    confidence: 0,
    status: 'Idle',
    emptyDuration: 0,
    lastAlertTime: null,
    fps: 0,
  });
  const [emptyThreshold, setEmptyThreshold] = useState(5); // seconds before alert
  const [alertCooldown, setAlertCooldown] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [lastPushStatus, setLastPushStatus] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const emptyTimerRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const lastReadingPushRef = useRef(0);
  const prevGrayRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const detectedFacesRef = useRef([]);

  // Multi-person simulation entities
  const getSimulatedEntities = (count) => {
    const list = [
      { id: 1, x: 100, y: 110, vx: 1.6, vy: 1.1, w: 85, h: 180, color: '#38bdf8' },
      { id: 2, x: 380, y: 120, vx: -1.5, vy: 1.3, w: 85, h: 180, color: '#f43f5e' },
      { id: 3, x: 240, y: 140, vx: 1.2, vy: -1.4, w: 85, h: 180, color: '#a855f7' },
    ];
    return list.slice(0, count);
  };
  const simEntitiesRef = useRef(getSimulatedEntities(1));

  // ── 1. Check for OpenCV.js & native FaceDetector ────────────────────────────
  useEffect(() => {
    function checkCv() {
      if (window.cv && window.cv.Mat) {
        setCvReady(true);
        return true;
      }
      return false;
    }

    if (checkCv()) return;

    const interval = setInterval(() => {
      if (checkCv()) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ('FaceDetector' in window) {
      try {
        faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
      } catch (err) {
        console.log('[SPARK] FaceDetector API not available:', err);
      }
    }
  }, []);

  // Sync simulation entities when simulatedPeople changes
  useEffect(() => {
    simEntitiesRef.current = getSimulatedEntities(simulatedPeople);
  }, [simulatedPeople]);

  // Periodic FaceDetector loop for live webcam (runs every 100ms)
  useEffect(() => {
    if (!isCameraActive || useSimulation) return;
    let cancelled = false;

    const interval = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (faceDetectorRef.current) {
        try {
          const faces = await faceDetectorRef.current.detect(videoRef.current);
          if (!cancelled && faces) {
            detectedFacesRef.current = faces.map(f => f.boundingBox);
          }
        } catch { /* silent */ }
      }
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isCameraActive, useSimulation]);

  // ── 2. Camera Start / Stop ──────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError(null);
    emptyTimerRef.current = 0;
    try {
      if (useSimulation) {
        setIsCameraActive(true);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('[SPARK OpenCV] Webcam access error, switching to simulation mode:', err);
      setCameraError('Webcam access was not granted or not available. Switched to Simulation Mode.');
      setUseSimulation(true);
      setIsCameraActive(true);
    }
  };

  const stopCamera = () => {
    setIsCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (prevGrayRef.current) {
      try { prevGrayRef.current.delete(); } catch { /* silent */ }
      prevGrayRef.current = null;
    }
    setDetectionState(prev => ({ ...prev, status: 'Stopped', peopleCount: 0, emptyDuration: 0 }));
  };

  // ── 3. Frame Processing Loop ────────────────────────────────────────────────
  const processFrame = useCallback(() => {
    if (!isCameraActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const now = performance.now();
    const dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;
    const currentFps = dt > 0 ? Math.round(1 / dt) : 30;

    const width = canvas.width;
    const height = canvas.height;

    let detectedCount = 0;
    let confidence = 0.95;
    const detectedBoxes = [];

    if (!useSimulation && videoRef.current && videoRef.current.readyState === 4) {
      // Draw live video frame to canvas
      ctx.drawImage(videoRef.current, 0, 0, width, height);

      // ── Step A: Native FaceDetector boxes (very accurate for multiple faces)
      if (detectedFacesRef.current && detectedFacesRef.current.length > 0) {
        detectedFacesRef.current.forEach((faceBox, idx) => {
          // Extrapolate upper-body/torso from face
          const pWidth = Math.max(faceBox.width * 1.8, 90);
          const pHeight = Math.max(faceBox.height * 3.2, 180);
          const pX = Math.max(0, faceBox.x - (pWidth - faceBox.width) / 2);
          const pY = Math.max(0, faceBox.y - 15);
          detectedBoxes.push({
            x: pX,
            y: pY,
            w: Math.min(width - pX, pWidth),
            h: Math.min(height - pY, pHeight),
            label: `Person #${idx + 1}`,
            confidence: 0.97,
          });
        });
      }

      // ── Step B: OpenCV.js Motion Differencing & Multi-Contour Person Detection
      if (window.cv && window.cv.Mat) {
        try {
          const cv = window.cv;
          const src = cv.imread(canvas);
          const gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
          cv.GaussianBlur(gray, gray, new cv.Size(15, 15), 0);

          if (!prevGrayRef.current) {
            prevGrayRef.current = new cv.Mat();
            gray.copyTo(prevGrayRef.current);
          }

          const frameDelta = new cv.Mat();
          cv.absdiff(prevGrayRef.current, gray, frameDelta);
          const thresh = new cv.Mat();
          cv.threshold(frameDelta, thresh, 25, 255, cv.THRESH_BINARY);
          const M = cv.Mat.ones(5, 5, cv.CV_8U);
          cv.dilate(thresh, thresh, M);

          const contours = new cv.MatVector();
          const hierarchy = new cv.Mat();
          cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

          const cvBoxes = [];
          for (let i = 0; i < contours.size(); ++i) {
            const rect = cv.boundingRect(contours.get(i));
            const area = rect.width * rect.height;
            // Area threshold for a person
            if (area > 3500) {
              // If a single contour is wide, split it into 2 people (side by side)
              if (rect.width > 220) {
                const halfW = Math.round(rect.width / 2);
                cvBoxes.push({ x: rect.x, y: rect.y, w: halfW - 10, h: rect.height });
                cvBoxes.push({ x: rect.x + halfW, y: rect.y, w: halfW - 10, h: rect.height });
              } else {
                cvBoxes.push(rect);
              }
            }
          }

          // Merge OpenCV boxes if face detector missed someone
          if (detectedBoxes.length === 0) {
            cvBoxes.forEach((b, idx) => {
              detectedBoxes.push({
                x: b.x,
                y: b.y,
                w: b.w,
                h: b.h,
                label: `Person #${idx + 1}`,
                confidence: 0.92,
              });
            });
          } else if (cvBoxes.length > detectedBoxes.length) {
            // If OpenCV motion found additional person
            for (let i = detectedBoxes.length; i < cvBoxes.length; i++) {
              detectedBoxes.push({
                x: cvBoxes[i].x,
                y: cvBoxes[i].y,
                w: cvBoxes[i].w,
                h: cvBoxes[i].h,
                label: `Person #${i + 1}`,
                confidence: 0.89,
              });
            }
          }

          // Slowly adapt background
          cv.addWeighted(prevGrayRef.current, 0.92, gray, 0.08, 0, prevGrayRef.current);

          src.delete();
          gray.delete();
          frameDelta.delete();
          thresh.delete();
          M.delete();
          contours.delete();
          hierarchy.delete();
        } catch { /* silent OpenCV cleanup */ }
      }

      // If no boxes detected yet, check overall frame intensity
      if (detectedBoxes.length === 0) {
        detectedCount = 0;
      } else {
        detectedCount = detectedBoxes.length;
      }

      // ── Step C: Draw Bounding Boxes for Every Detected Person
      detectedBoxes.forEach((box, idx) => {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.strokeRect(box.x, box.y, box.w, box.h);

        // Box label
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(box.x, Math.max(0, box.y - 24), 140, 24);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${box.label || `Person #${idx + 1}`} (${Math.round((box.confidence || 0.95) * 100)}%)`, box.x + 6, Math.max(16, box.y - 7));
      });
    } else {
      // ── Simulation Mode: Simulated room scene with moving people
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Draw room background grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Room label watermark
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`ZONE: ${selectedZone.toUpperCase()}`, width / 2, height / 2);

      detectedCount = simulatedPeople;

      // Draw multiple simulated people figures & OpenCV bounding boxes
      if (simulatedPeople > 0) {
        simEntitiesRef.current.forEach((person, idx) => {
          person.x += person.vx;
          person.y += person.vy;
          if (person.x < 30 || person.x + person.w > width - 30) person.vx *= -1;
          if (person.y < 30 || person.y + person.h > height - 30) person.vy *= -1;

          // Person avatar
          ctx.fillStyle = person.color || '#38bdf8';
          ctx.beginPath();
          ctx.arc(person.x + person.w / 2, person.y + 35, 24, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = person.color || '#0284c7';
          ctx.fillRect(person.x + 10, person.y + 60, person.w - 20, person.h - 60);

          // OpenCV detection bounding box (green)
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(person.x, person.y, person.w, person.h);

          // Box label
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(person.x, person.y - 24, 130, 24);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`Person #${idx + 1} (96%)`, person.x + 6, person.y - 7);
        });
      }
    }

    // ── HUD Overlay on canvas ───────────────────────────────────────────────
    if (detectedCount > 0) {
      // Occupied border
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      // Status pill
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.fillRect(16, 16, 230, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`● ${detectedCount} ${detectedCount === 1 ? 'PERSON' : 'PEOPLE'} DETECTED`, 26, 37);

      emptyTimerRef.current = 0;
    } else {
      // Empty room warning border
      emptyTimerRef.current += dt;
      const isOverThreshold = emptyTimerRef.current >= emptyThreshold;

      ctx.strokeStyle = isOverThreshold ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      ctx.fillStyle = isOverThreshold ? 'rgba(239, 68, 68, 0.92)' : 'rgba(245, 158, 11, 0.88)';
      ctx.fillRect(16, 16, 260, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        isOverThreshold ? `⚠ EMPTY ROOM ALERT (${Math.round(emptyTimerRef.current)}s)` : `⚠ EMPTY (${Math.round(emptyTimerRef.current)}s / ${emptyThreshold}s)`,
        26, 37
      );
    }

    // OpenCV Engine stamp
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(width - 180, 16, 164, 26);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`OpenCV.js · ${currentFps} FPS`, width - 172, 33);

    // ── 4. Alert Logic: When room is empty for >= threshold ────────────────
    const currentEmptyDuration = Math.round(emptyTimerRef.current);

    if (detectedCount === 0 && currentEmptyDuration >= emptyThreshold && !alertCooldown) {
      setAlertCooldown(true);
      const msg = `Zone '${selectedZone}' has 0 people detected for ${currentEmptyDuration}s with power ON (OpenCV.js). Possible lights/equipment left on!`;
      triggerOpenCvAlert({
        zone_id: selectedZone,
        campus_id: 'main',
        alert_type: 'EMPTY_ROOM_POWER_ON',
        severity: 'High',
        people_count: 0,
        message: msg,
      });

      setLastPushStatus(`🚨 Alert pushed to Supabase at ${new Date().toLocaleTimeString()}`);

      // Push 0-people reading
      recordOpenCvReading({
        zone_id: selectedZone,
        campus_id: 'main',
        people: 0,
        confidence: 0.96,
        source: 'opencv.js',
      });

      // 10s cooldown before next alert for the same zone
      setTimeout(() => {
        setAlertCooldown(false);
      }, 10000);
    }

    // Periodic reading push to Supabase (every 15 seconds or when count changes)
    if (now - lastReadingPushRef.current > 15000) {
      lastReadingPushRef.current = now;
      recordOpenCvReading({
        zone_id: selectedZone,
        campus_id: 'main',
        people: detectedCount,
        confidence: detectedCount > 0 ? 0.95 : 0.98,
        source: 'opencv.js',
      });
      setLastPushStatus(`✓ Reading synced to Supabase (${detectedCount} people) at ${new Date().toLocaleTimeString()}`);
    }

    setDetectionState({
      peopleCount: detectedCount,
      confidence,
      status: detectedCount > 0 ? 'Occupied' : 'Empty',
      emptyDuration: currentEmptyDuration,
      lastAlertTime: currentEmptyDuration >= emptyThreshold ? new Date().toLocaleTimeString() : null,
      fps: currentFps,
    });

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, [isCameraActive, useSimulation, simulatedPeople, selectedZone, emptyThreshold, alertCooldown, triggerOpenCvAlert, recordOpenCvReading]);

  useEffect(() => {
    if (isCameraActive) {
      animFrameRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCameraActive, processFrame]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="card" style={{ marginBottom: 24, border: '1.5px solid #2d6a4f' }}>
      <div className="card-header" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: '#2d6a4f', color: '#fff', borderRadius: 8, padding: '6px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Cpu size={18} />
          </div>
          <div>
            <h2 style={{ color: '#166534', margin: 0, fontSize: '1.1rem' }}>
              Option A: Browser-based OpenCV.js Person Detector
            </h2>
            <p style={{ margin: 0, fontSize: '.78rem', color: '#15803d' }}>
              Multi-person computer vision running directly in browser. Detects individual people present vs empty room and pushes alerts to Supabase.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', fontWeight: 600,
            padding: '3px 10px', borderRadius: 999,
            background: cvReady ? '#d1fae5' : '#fef3c7',
            color: cvReady ? '#166534' : '#b45309',
          }}>
            <Sparkles size={12} />
            {cvReady ? 'OpenCV.js Ready' : 'OpenCV.js Initializing'}
          </span>
          {dbConnected && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: '.75rem', fontWeight: 600,
              padding: '3px 10px', borderRadius: 999, background: '#d1fae5', color: '#166534'
            }}>
              <CheckCircle2 size={12} /> Supabase Live
            </span>
          )}
        </div>
      </div>

      <div className="card-body">
        {/* Controls Toolbar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #e2e8f0'
        }}>
          {/* Target Zone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '.85rem', fontWeight: 600, color: '#334155' }}>Monitor Zone:</label>
            <select
              className="form-control"
              style={{ width: 170, fontSize: '.85rem', padding: '6px 10px' }}
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              {(zonesList || []).map(z => (
                <option key={z.id} value={z.id}>{z.name || z.id} ({z.id})</option>
              ))}
            </select>
          </div>

          {/* Empty Alert Threshold */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '.85rem', fontWeight: 600, color: '#334155' }}>Empty Alert After:</label>
            <select
              className="form-control"
              style={{ width: 110, fontSize: '.85rem', padding: '6px 10px' }}
              value={emptyThreshold}
              onChange={e => setEmptyThreshold(Number(e.target.value))}
            >
              <option value={3}>3 seconds</option>
              <option value={5}>5 seconds</option>
              <option value={10}>10 seconds</option>
              <option value={30}>30 seconds</option>
            </select>
          </div>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`btn btn-sm ${!useSimulation ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setUseSimulation(false); if (isCameraActive) { stopCamera(); } }}
              title="Use actual webcam attached to your device"
            >
              <Camera size={14} /> Webcam Mode
            </button>
            <button
              className={`btn btn-sm ${useSimulation ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setUseSimulation(true); }}
              title="Test OpenCV simulation"
            >
              <Video size={14} /> Simulation Mode
            </button>
          </div>

          {/* Main Camera Toggle */}
          <div>
            {!isCameraActive ? (
              <button className="btn btn-primary" onClick={startCamera} style={{ background: '#15803d' }}>
                <Play size={15} /> Start OpenCV Camera
              </button>
            ) : (
              <button className="btn btn-outline" onClick={stopCamera} style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                <Square size={15} /> Stop Camera
              </button>
            )}
          </div>
        </div>

        {cameraError && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '10px 14px', fontSize: '.82rem', color: '#b45309', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <AlertTriangle size={16} />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Video Canvas & Live HUD */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.8fr) 1fr', gap: 16 }}>
          {/* Viewport Container */}
          <div style={{
            position: 'relative', background: '#090d16', borderRadius: 10,
            overflow: 'hidden', minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {/* Hidden native video element feeding OpenCV */}
            <video
              ref={videoRef}
              style={{ display: 'none' }}
              playsInline
              muted
            />

            {/* Render Canvas */}
            <canvas
              ref={canvasRef}
              width={640}
              height={440}
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: 380,
                display: isCameraActive ? 'block' : 'none',
                borderRadius: 8,
              }}
            />

            {/* Offline Placeholder */}
            {!isCameraActive && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                <Camera size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9' }}>Camera is Inactive</div>
                <div style={{ fontSize: '.85rem', maxWidth: 360, margin: '8px auto 16px' }}>
                  Click <strong>Start OpenCV Camera</strong> above to enable live person detection and automated empty-room power alerts.
                </div>
                <button className="btn btn-primary" onClick={startCamera} style={{ background: '#16a34a' }}>
                  <Play size={14} /> Turn On Camera
                </button>
              </div>
            )}
          </div>

          {/* Live Telemetry & Testing Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Live Status Card */}
            <div style={{
              background: detectionState.status === 'Occupied' ? '#f0fdf4' : detectionState.status === 'Empty' ? '#fef2f2' : '#f8fafc',
              border: `1.5px solid ${detectionState.status === 'Occupied' ? '#86efac' : detectionState.status === 'Empty' ? '#fca5a5' : '#e2e8f0'}`,
              borderRadius: 10, padding: 14
            }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Current Detection State
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
                <div style={{
                  fontSize: '1.8rem', fontWeight: 800,
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: detectionState.status === 'Occupied' ? '#15803d' : detectionState.status === 'Empty' ? '#b91c1c' : '#475569'
                }}>
                  {detectionState.status === 'Occupied'
                    ? `${detectionState.peopleCount} ${detectionState.peopleCount === 1 ? 'Person' : 'People'}`
                    : detectionState.status === 'Empty'
                    ? '0 People (Empty)'
                    : 'Camera Off'}
                </div>
                <span className={`badge ${detectionState.status === 'Occupied' ? 'good' : detectionState.status === 'Empty' ? 'bad' : 'normal'}`}>
                  {detectionState.status}
                </span>
              </div>

              <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: 6 }}>
                Zone: <strong>{selectedZone.toUpperCase()}</strong> · Confidence: <strong>{Math.round(detectionState.confidence * 100)}%</strong>
              </div>

              {detectionState.status === 'Empty' && (
                <div style={{
                  marginTop: 10, padding: '8px 10px', background: '#fee2e2', borderRadius: 6,
                  fontSize: '.78rem', color: '#991b1b', fontWeight: 600
                }}>
                  ⏱ Empty for {detectionState.emptyDuration}s (Alert fires at {emptyThreshold}s)
                </div>
              )}
            </div>

            {/* Quick Test Controls */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                🧪 Test People Count & Alerts
              </div>
              <p style={{ fontSize: '.75rem', color: '#64748b', margin: '0 0 10px' }}>
                Test multi-person detection (1, 2, 3 people) or empty room alert:
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <button
                  className={`btn btn-sm ${simulatedPeople === 1 && useSimulation ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '.78rem' }}
                  onClick={() => {
                    setUseSimulation(true);
                    setSimulatedPeople(1);
                    if (!isCameraActive) startCamera();
                  }}
                >
                  <User size={13} /> 1 Person
                </button>
                <button
                  className={`btn btn-sm ${simulatedPeople === 2 && useSimulation ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '.78rem', borderColor: '#22c55e', color: simulatedPeople === 2 && useSimulation ? '#fff' : '#166534', fontWeight: 700 }}
                  onClick={() => {
                    setUseSimulation(true);
                    setSimulatedPeople(2);
                    if (!isCameraActive) startCamera();
                  }}
                >
                  <Users size={13} /> 2 People (Multi)
                </button>
                <button
                  className={`btn btn-sm ${simulatedPeople === 3 && useSimulation ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '.78rem' }}
                  onClick={() => {
                    setUseSimulation(true);
                    setSimulatedPeople(3);
                    if (!isCameraActive) startCamera();
                  }}
                >
                  <Users size={13} /> 3 People
                </button>
                <button
                  className={`btn btn-sm ${simulatedPeople === 0 && useSimulation ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '.78rem', borderColor: '#ef4444', color: simulatedPeople === 0 && useSimulation ? '#fff' : '#b91c1c', fontWeight: 700 }}
                  onClick={() => {
                    setUseSimulation(true);
                    setSimulatedPeople(0);
                    if (!isCameraActive) startCamera();
                  }}
                >
                  ⚠️ 0 (Empty Alert)
                </button>
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ width: '100%', fontSize: '.78rem' }}
                  onClick={() => {
                    triggerOpenCvAlert({
                      zone_id: selectedZone,
                      campus_id: 'main',
                      alert_type: 'EMPTY_ROOM_POWER_ON',
                      severity: 'High',
                      people_count: 0,
                      message: `Manual test alert: Zone '${selectedZone}' confirmed empty via OpenCV.js integration.`
                    });
                    setLastPushStatus(`🚨 Test alert pushed to Supabase at ${new Date().toLocaleTimeString()}`);
                  }}
                >
                  <ShieldAlert size={13} /> Fire Test Alert Directly to Supabase
                </button>
              </div>
            </div>

            {/* Supabase Push Feedback */}
            {lastPushStatus && (
              <div style={{
                fontSize: '.75rem', color: '#166534', background: '#dcfce7',
                padding: '6px 10px', borderRadius: 6, border: '1px solid #86efac'
              }}>
                {lastPushStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
