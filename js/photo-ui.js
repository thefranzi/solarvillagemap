# js/photo-ui.js
@"
document.addEventListener('DOMContentLoaded', ()=>{
  const input = document.getElementById('photoInput');
  const preview = document.getElementById('photoPreview');
  const uploadBtn = document.getElementById('photoUpload');
  const cancelBtn = document.getElementById('photoCancel');
  const container = document.getElementById('photo-capture');
  if(!input) return;

  // public API
  window.openPhotoUI = function(meta){
    container.style.display = 'block';
    container.dataset.meta = JSON.stringify(meta || {});
  };
  window.closePhotoUI = ()=> {
    container.style.display = 'none';
    preview.innerHTML = '';
    uploadBtn.style.display = 'none';
    input.value = '';
  };

  input.addEventListener('change', async (ev)=>{
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    preview.innerHTML = 'Preparing preview...';
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img id="previewImg" src="\${url}" style="max-width:100%; height:auto; border-radius:8px;">`;
    const compressed = await compressImage(file, 1600);
    uploadBtn.style.display = 'inline-block';
    uploadBtn.onclick = ()=> uploadImage(compressed, file.name);
  });

  cancelBtn.onclick = ()=> window.closePhotoUI();

  async function compressImage(file, maxDim=1600){
    return new Promise((res, rej)=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(Math.max(w,h) > maxDim){
          if(w>h){ h = Math.round(h*(maxDim/w)); w = maxDim; }
          else    { w = Math.round(w*(maxDim/h)); h = maxDim; }
        }
        const c = document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        c.toBlob(b=>res(b),'image/jpeg',0.78);
      };
      img.onerror = ()=> rej(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  }

  function uploadImage(blob, filename){
    const form = new FormData();
    form.append('file', blob, filename);
    try { form.append('meta', container.dataset.meta || '{}'); } catch(e){}
    // Replace with your endpoint / function
    fetch('/.netlify/functions/upload-photo', { method:'POST', body: form })
      .then(r=>{ if(!r.ok) throw new Error('Upload failed: '+r.status); return r.json(); })
      .then(()=>{ alert('Upload OK'); window.closePhotoUI(); if(window.reloadPhotosLayer) window.reloadPhotosLayer(); })
      .catch(e=>{ console.error(e); alert('Upload failed'); });
  }
});
"@ | Set-Content .\js\photo-ui.js -Encoding utf8