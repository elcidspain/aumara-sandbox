/* AUMARA flight sandbox — bright graded exterior path; look + fly/stop */
(function () {
  'use strict';

  /* Valley opens clearly between houses ~24s in this 64.2s clip. */
  var VALLEY_AT = 24.0;
  var VALLEY_WINDOW = 1.2;
  var LOOK_YAW_MAX = 18;
  var LOOK_PITCH_MAX = 12;
  var DRAG_SENS = 0.085;
  var GYRO_SENS = 0.55;
  var NUDGE_YAW = 6;

  var video = document.getElementById('flight');
  var stage = document.getElementById('stage');
  var place = document.getElementById('place');
  var chrome = document.getElementById('chrome');
  var btnGyro = document.getElementById('btnGyro');
  var btnForward = document.getElementById('btnForward');
  var btnLookHint = document.getElementById('btnLookHint');
  var btnLeft = document.getElementById('btnLeft');
  var btnRight = document.getElementById('btnRight');
  var tap = document.getElementById('tap');
  var hint = document.getElementById('hint');

  var state = {
    started: false,
    flying: false,
    pausedAtValley: false,
    valleyDone: false,
    yaw: 0,
    pitch: 0,
    drag: null,
    gyroOn: false,
    gyroBase: null,
    reduceMotion: false,
    loopBetween: true
  };

  try {
    state.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  function isTouch() {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  function needsGyroPermission() {
    return typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';
  }

  function showHint(text, ms) {
    if (!hint) return;
    hint.textContent = text;
    hint.hidden = false;
    hint.classList.add('show');
    clearTimeout(showHint._t);
    if (ms) {
      showHint._t = setTimeout(function () {
        hint.classList.remove('show');
      }, ms);
    }
  }

  function applyLook() {
    var y = Math.max(-LOOK_YAW_MAX, Math.min(LOOK_YAW_MAX, state.yaw));
    var p = Math.max(-LOOK_PITCH_MAX, Math.min(LOOK_PITCH_MAX, state.pitch));
    state.yaw = y;
    state.pitch = p;
    var tx = (-y / LOOK_YAW_MAX) * 7.5;
    var ty = (p / LOOK_PITCH_MAX) * 5.5;
    stage.style.transform = 'translate3d(' + tx + '%, ' + ty + '%, 0)';
  }

  function nudgeLook(dir) {
    if (!state.started) return;
    state.yaw += dir * NUDGE_YAW;
    applyLook();
  }

  function setFlying(on) {
    state.flying = !!on;
    if (on) {
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      btnForward.textContent = 'Stop';
      btnForward.disabled = false;
      place.classList.remove('show');
      setTimeout(function () { place.hidden = true; }, 900);
    } else {
      video.pause();
      btnForward.textContent = state.pausedAtValley ? 'Fly' : 'Fly';
      btnForward.disabled = false;
    }
  }

  function triggerValleyPause() {
    if (state.valleyDone || state.reduceMotion) return;
    state.valleyDone = true;
    state.pausedAtValley = true;
    setFlying(false);
    place.hidden = false;
    requestAnimationFrame(function () {
      place.classList.add('show');
    });
    showHint('Look · then Fly', 4200);
  }

  function onTimeUpdate() {
    if (!state.started) return;
    var t = video.currentTime || 0;
    if (!state.valleyDone && t >= VALLEY_AT && t <= VALLEY_AT + VALLEY_WINDOW) {
      if (state.flying) triggerValleyPause();
    }
    if (state.loopBetween && video.duration && t >= video.duration - 0.15) {
      if (state.flying) {
        video.currentTime = Math.min(VALLEY_AT + 2.5, Math.max(8, video.duration * 0.12));
      }
    }
  }

  function beginFlight() {
    if (state.started) return;
    state.started = true;
    tap.classList.add('gone');
    setTimeout(function () { tap.hidden = true; }, 650);
    chrome.classList.add('ready');
    btnForward.disabled = false;

    if (isTouch()) {
      if (needsGyroPermission()) {
        btnGyro.hidden = false;
        btnGyro.textContent = 'Enable look';
      } else {
        btnGyro.hidden = false;
        btnGyro.textContent = 'Tilt look';
        tryEnableGyro();
      }
      btnLookHint.hidden = true;
      showHint('← → look · Fly / Stop', 3800);
    } else {
      btnGyro.hidden = true;
      btnLookHint.hidden = false;
      btnLookHint.textContent = 'Drag look';
      showHint('← → or drag · Space = Fly/Stop', 3800);
    }

    setFlying(true);
  }

  function tryEnableGyro() {
    function onOrient(ev) {
      if (!state.gyroOn) return;
      var alpha = ev.alpha;
      var beta = ev.beta;
      var gamma = ev.gamma;
      if (alpha == null && beta == null && gamma == null) return;
      if (!state.gyroBase) {
        state.gyroBase = { alpha: alpha || 0, beta: beta || 0, gamma: gamma || 0 };
      }
      var dAlpha = (alpha || 0) - state.gyroBase.alpha;
      var dBeta = (beta || 0) - state.gyroBase.beta;
      var dGamma = (gamma || 0) - state.gyroBase.gamma;
      var yaw = (-dGamma * GYRO_SENS) + (-dAlpha * 0.15);
      var pitch = (dBeta * GYRO_SENS * 0.45);
      if (window.orientation === 90 || window.orientation === -90) {
        yaw = (dBeta * GYRO_SENS * 0.35);
        pitch = (-dGamma * GYRO_SENS * 0.35);
      }
      state.yaw = yaw;
      state.pitch = pitch;
      applyLook();
    }

    window.addEventListener('deviceorientation', onOrient, true);
    window.addEventListener('deviceorientationabsolute', onOrient, true);
    state.gyroOn = true;
    btnGyro.textContent = 'Looking';
    btnGyro.classList.add('soft');
  }

  function requestGyro() {
    if (!needsGyroPermission()) {
      tryEnableGyro();
      return;
    }
    DeviceOrientationEvent.requestPermission()
      .then(function (res) {
        if (res === 'granted') {
          tryEnableGyro();
          showHint('Tilt to look', 2400);
        } else {
          showHint('Use ← → or drag', 3200);
          enableDragFallback();
        }
      })
      .catch(function () {
        showHint('Use ← → or drag', 3200);
        enableDragFallback();
      });
  }

  function enableDragFallback() {
    btnLookHint.hidden = false;
    btnLookHint.textContent = 'Drag look';
  }

  function onPointerDown(e) {
    if (e.target.closest && e.target.closest('.pill, .tap-start')) return;
    if (!state.started) return;
    state.drag = {
      x: e.clientX,
      y: e.clientY,
      yaw: state.yaw,
      pitch: state.pitch,
      id: e.pointerId
    };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onPointerMove(e) {
    if (!state.drag || state.drag.id !== e.pointerId) return;
    var dx = e.clientX - state.drag.x;
    var dy = e.clientY - state.drag.y;
    state.yaw = state.drag.yaw + dx * DRAG_SENS;
    state.pitch = state.drag.pitch - dy * DRAG_SENS;
    applyLook();
  }
  function onPointerUp(e) {
    if (state.drag && state.drag.id === e.pointerId) state.drag = null;
  }

  function toggleForward() {
    if (!state.started) {
      beginFlight();
      return;
    }
    if (state.flying) setFlying(false);
    else {
      state.pausedAtValley = false;
      setFlying(true);
    }
  }

  tap.addEventListener('click', beginFlight);
  tap.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      beginFlight();
    }
  });
  btnForward.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleForward();
  });
  btnGyro.addEventListener('click', function (e) {
    e.stopPropagation();
    requestGyro();
  });
  if (btnLeft) {
    btnLeft.addEventListener('click', function (e) {
      e.stopPropagation();
      nudgeLook(-1);
    });
  }
  if (btnRight) {
    btnRight.addEventListener('click', function (e) {
      e.stopPropagation();
      nudgeLook(1);
    });
  }

  var world = document.getElementById('world');
  world.addEventListener('pointerdown', onPointerDown);
  world.addEventListener('pointermove', onPointerMove);
  world.addEventListener('pointerup', onPointerUp);
  world.addEventListener('pointercancel', onPointerUp);

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      e.preventDefault();
      toggleForward();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      nudgeLook(-1);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      nudgeLook(1);
    }
  });

  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('loadedmetadata', function () {
    if (video.duration && video.duration < VALLEY_AT + 2) {
      VALLEY_AT = Math.max(4, video.duration * 0.38);
    }
  });

  video.muted = true;
  applyLook();
})();
