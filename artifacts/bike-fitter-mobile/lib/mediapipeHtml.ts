export const MEDIAPIPE_HTML = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#f0f6fc;font-family:-apple-system,system-ui,sans-serif;overflow:hidden;height:100vh;width:100vw}
.wrap{position:relative;display:flex;flex-direction:column;height:100vh}
.cam{position:relative;flex:1;background:#000;overflow:hidden}
video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}
canvas{position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1)}
.overlay-status{position:absolute;top:12px;left:12px;right:12px;background:rgba(13,17,23,0.85);border:1px solid #30363d;border-radius:10px;padding:12px 16px;font-size:16px;text-align:center;color:#f0f6fc;line-height:1.4}
.overlay-status.warn{color:#f59e0b;border-color:#f59e0b40}
.overlay-status.ok{color:#10b981;border-color:#10b98140}
.controls{background:#0d1117;padding:12px;padding-bottom:max(12px, env(safe-area-inset-bottom));gap:8px;display:flex;flex-direction:column;border-top:1px solid #30363d}
.row{display:flex;gap:8px}
.btn{flex:1;padding:16px;border-radius:10px;border:none;font-size:16px;font-weight:600;cursor:pointer;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent}
.btn:active{opacity:0.75}
.btn-primary{background:#3b82f6;color:#fff}
.btn-primary:disabled{background:#1e3a5f;color:#4b6f9e;cursor:default}
.btn-success{background:#10b981;color:#fff}
.btn-outline{background:#1f2937;color:#9ca3af}
.cap-row{display:flex;justify-content:space-between;padding:0 4px}
.cap-item{font-size:16px;color:#8b949e;display:flex;align-items:center;gap:6px}
.cap-item.done{color:#10b981}
.dot{width:8px;height:8px;border-radius:50%;background:#30363d;flex-shrink:0}
.dot.done{background:#10b981}
.loader{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0d1117;gap:16px;z-index:10}
.loader-text{font-size:16px;color:#8b949e}
.spinner{width:40px;height:40px;border:3px solid #30363d;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="wrap">
  <div class="cam" id="camWrap">
    <div class="loader" id="loader">
      <div class="spinner"></div>
      <div class="loader-text">載入姿態偵測引擎...</div>
    </div>
    <video id="video" playsinline autoplay muted></video>
    <canvas id="canvas"></canvas>
    <div class="overlay-status" id="status">初始化相機...</div>
  </div>
  <div class="controls">
    <div class="cap-row">
      <div class="cap-item" id="ci6"><div class="dot" id="dot6"></div>6 點鐘</div>
      <div class="cap-item" id="ci3"><div class="dot" id="dot3"></div>3 點鐘</div>
    </div>
    <div class="row">
      <button class="btn btn-primary" id="btn6" disabled onclick="capture('6oclock')">擷取 6 點鐘</button>
      <button class="btn btn-outline" id="btn3" disabled onclick="capture('3oclock')">擷取 3 點鐘</button>
    </div>
    <button class="btn btn-outline" id="btnReset" onclick="resetCaptures()">重新開始</button>
  </div>
</div>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js" crossorigin="anonymous"></script>
<script>
var latestLandmarks = null;
var captured = { '6oclock': false, '3oclock': false };
var poseReady = false;

function postMsg(data) {
  try {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  } catch(e) {}
}

function setStatus(msg, type) {
  var el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'overlay-status' + (type ? ' ' + type : '');
}

function atan2Angle(a, b, c) {
  var r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  var angle = Math.abs(r * 180 / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

function extractAngles(lm, position) {
  var sh = lm[12], el = lm[14], wr = lm[16];
  var hi = lm[24], kn = lm[26], an = lm[28];
  if (!sh || !el || !wr || !hi || !kn || !an) return null;

  var kneeInterior = atan2Angle(hi, kn, an);
  var kneeAngle = Math.round((180 - kneeInterior) * 10) / 10;
  var hipAngle = Math.round(atan2Angle(sh, hi, kn) * 10) / 10;
  var vertRef = { x: hi.x, y: hi.y - 0.1 };
  var torsoAngle = Math.round(atan2Angle(vertRef, hi, sh) * 10) / 10;
  var elbowAngle = Math.round(atan2Angle(sh, el, wr) * 10) / 10;
  var kopsOffset = undefined;
  if (position === '3oclock') {
    kopsOffset = Math.round((kn.x - an.x) * 1000) / 10;
  }
  return { kneeAngle, hipAngle, torsoAngle, elbowAngle, position, kopsOffset };
}

function validateSide(lm) {
  var ls = lm[11], rs = lm[12];
  if (!ls || !rs) return false;
  var dx = ls.x - rs.x, dy = ls.y - rs.y;
  var dist = Math.sqrt(dx*dx + dy*dy);
  if (dist > 0.15) return false;
  var keys = [12,14,16,24,26,28];
  for (var i=0;i<keys.length;i++) {
    var p = lm[keys[i]];
    if (!p || (p.visibility !== undefined && p.visibility < 0.5)) return false;
  }
  return true;
}

function capture(position) {
  if (!latestLandmarks) { setStatus('尚未偵測到姿態，請稍候', 'warn'); return; }
  if (!validateSide(latestLandmarks)) { setStatus('請確保側面完整入鏡再擷取', 'warn'); return; }
  var angles = extractAngles(latestLandmarks, position);
  if (!angles) { setStatus('關節偵測失敗，請重試', 'warn'); return; }
  captured[position] = true;
  updateUI();
  postMsg({ type: 'captured', position: position, angles: angles });
  var label = position === '6oclock' ? '6 點鐘' : '3 點鐘';
  setStatus(label + ' 擷取成功', 'ok');
  if (captured['6oclock'] && captured['3oclock']) {
    setTimeout(function() { postMsg({ type: 'all_captured' }); }, 500);
  }
}

function resetCaptures() {
  captured = { '6oclock': false, '3oclock': false };
  updateUI();
  setStatus('請側面面對鏡頭，踏板踩至 6 點鐘位置（最低點）');
  postMsg({ type: 'reset' });
}

function updateUI() {
  var b6 = document.getElementById('btn6');
  var b3 = document.getElementById('btn3');
  var dot6 = document.getElementById('dot6');
  var dot3 = document.getElementById('dot3');
  var ci6 = document.getElementById('ci6');
  var ci3 = document.getElementById('ci3');
  if (captured['6oclock']) {
    b6.className = 'btn btn-success';
    b6.textContent = '6 點鐘 已擷取';
    dot6.className = 'dot done';
    ci6.className = 'cap-item done';
  }
  if (captured['3oclock']) {
    b3.className = 'btn btn-success';
    b3.textContent = '3 點鐘 已擷取';
    dot3.className = 'dot done';
    ci3.className = 'cap-item done';
  }
}

var pose = new Pose({
  locateFile: function(f) {
    return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/' + f;
  }
});

pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

pose.onResults(function(results) {
  var canvas = document.getElementById('canvas');
  var video = document.getElementById('video');
  canvas.width = video.videoWidth || canvas.clientWidth;
  canvas.height = video.videoHeight || canvas.clientHeight;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.poseLandmarks) {
    latestLandmarks = null;
    if (poseReady) setStatus('未偵測到人體，請確保全身側面入鏡');
    return;
  }

  var lm = results.poseLandmarks;
  latestLandmarks = lm;

  var W = canvas.width, H = canvas.height;
  var connections = [
    [11,12],[11,13],[13,15],[12,14],[14,16],
    [11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28]
  ];
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3;
  for (var i=0;i<connections.length;i++) {
    var a = lm[connections[i][0]], b = lm[connections[i][1]];
    if (!a || !b) continue;
    if ((a.visibility||1)<0.4 || (b.visibility||1)<0.4) continue;
    ctx.beginPath();
    ctx.moveTo(a.x*W, a.y*H);
    ctx.lineTo(b.x*W, b.y*H);
    ctx.stroke();
  }

  var keyIdx = [12,14,16,24,26,28];
  for (var j=0;j<keyIdx.length;j++) {
    var p = lm[keyIdx[j]];
    if (!p || (p.visibility||1)<0.4) continue;
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(p.x*W, p.y*H, 8, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#ef4444';
    ctx.beginPath();
    ctx.arc(p.x*W, p.y*H, 5, 0, Math.PI*2);
    ctx.fill();
  }

  var valid = validateSide(lm);
  var b6 = document.getElementById('btn6');
  var b3 = document.getElementById('btn3');
  b6.disabled = !valid;
  b3.disabled = !valid;

  if (!poseReady) {
    poseReady = true;
    document.getElementById('loader').style.display = 'none';
    setStatus('請側面面對鏡頭，踏板踩至 6 點鐘位置（最低點）');
    b6.className = 'btn btn-primary';
    b3.className = 'btn btn-outline';
  }

  if (valid && !captured['6oclock']) {
    setStatus('偵測到側面姿態，可擷取 6 點鐘位置');
  } else if (valid && captured['6oclock'] && !captured['3oclock']) {
    setStatus('請將踏板移至 3 點鐘位置（水平向前）再擷取');
  } else if (!valid && poseReady) {
    setStatus('請確保全身側面完整入鏡，光線充足', 'warn');
  }
});

pose.initialize().then(function() {
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }).then(function(stream) {
    var video = document.getElementById('video');
    video.srcObject = stream;
    video.onloadeddata = function() {
      function processFrame() {
        if (video.readyState >= 2) {
          pose.send({ image: video }).catch(function(){});
        }
        requestAnimationFrame(processFrame);
      }
      processFrame();
    };
  }).catch(function(err) {
    document.getElementById('loader').style.display = 'none';
    setStatus('相機存取失敗：' + err.message, 'warn');
    postMsg({ type: 'camera_error', message: err.message });
  });
}).catch(function(err) {
  document.getElementById('loader').style.display = 'none';
  setStatus('姿態引擎載入失敗，請確認網路連線', 'warn');
  postMsg({ type: 'engine_error', message: err.message });
});
</script>
</body>
</html>`;
