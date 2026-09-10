// Adapted from hybrid-ai-blueprints PR5 pose-worker.js; local assets and CPU fallback.
let pose;
self.onmessage = async ({data:m}) => {
  if(m.type==='init') {
    try {
      const {PoseLandmarker,FilesetResolver}=await import('./vendor/mediapipe/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location).href);
      const options={baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/pose_landmarker_lite.task',self.location).href,delegate:'GPU'},runningMode:'VIDEO',numPoses:1};
      try {pose=await PoseLandmarker.createFromOptions(files,options);} catch {options.baseOptions.delegate='CPU';pose=await PoseLandmarker.createFromOptions(files,options);}
      postMessage({type:'ready'});
    } catch(e){postMessage({type:'error',message:String(e.message||e)});}
  }
  if(m.type==='frame') {
    try { const r=pose?.detectForVideo(m.bitmap,m.t);postMessage({type:'landmarks',landmarks:r?.landmarks?.[0]||null,t:m.t}); }
    catch(e){postMessage({type:'error',message:String(e.message||e)});}
    finally {m.bitmap.close();}
  }
};
