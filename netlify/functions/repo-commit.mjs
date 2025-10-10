/**
 * /.netlify/functions/repo-commit
 * Env required: GH_TOKEN (repo scope), GH_REPO ("owner/repo"), GH_BRANCH
 * POST JSON modes:
 * 1) { dataUrl, filename, subdir? } -> commit file under subdir/YYYYMMDD/
 * 2) { feature, geoTarget: "pins"|"photos" } -> append Feature to data/<target>.geojson
 */
export async function handler(event){
  try{
    if(event.httpMethod!=="POST") return { statusCode:405, body:"Method Not Allowed" };
    const env = (k,d=null)=> (typeof process!=="undefined" && process.env && process.env[k]) || d;
    const GH_TOKEN  = env("GH_TOKEN");
    const GH_REPO   = env("GH_REPO");
    const GH_BRANCH = env("GH_BRANCH","main");
    if(!GH_TOKEN || !GH_REPO) {
      return { statusCode:501, body: JSON.stringify({ ok:false, error:"Missing env", need:["GH_TOKEN","GH_REPO","GH_BRANCH"] }) };
    }
    const [owner, repo] = GH_REPO.split("/");
    const gh = async (path, init={})=>{
      const url = `https://api.github.com${path}`;
      const hdr = Object.assign({ "authorization":`Bearer ${GH_TOKEN}`, "accept":"application/vnd.github+json", "user-agent":"sv-repo-commit" }, (init.headers||{}));
      const res = await fetch(url, Object.assign(init,{ headers: hdr }));
      if(!res.ok){
        const txt = await res.text().catch(()=>res.statusText);
        throw new Error(`GitHub API ${res.status}: ${txt}`);
      }
      return res;
    };

    const body = JSON.parse(event.body||"{}");

    // Mode 1: commit a file (photo)
    if(body.dataUrl){
      const { dataUrl, filename="photo.jpg", subdir="uploads" } = body;
      const m = /^data:([\w\/\-\+\.]+);base64,(.*)$/i.exec(dataUrl||"");
      if(!m) return { statusCode:400, body:"Bad Request: dataUrl must be data:*;base64,..." };
      const contentType = m[1]; const b64 = m[2];
      const ymd = new Date().toISOString().slice(0,10).replace(/-/g,"");
      const safeName = filename.replace(/[^a-z0-9._-]+/gi,"_");
      const path = `${subdir}/${ymd}/${Date.now()}_${safeName}`;
      const put = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
        method:"PUT",
        body: JSON.stringify({
          message: `feat: add upload ${safeName}`,
          content: b64,
          branch: GH_BRANCH
        })
      }).then(r=>r.json());
      const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(GH_BRANCH)}/${path}`;
      return { statusCode:200, body: JSON.stringify({ ok:true, path, url:raw, contentType }) };
    }

    // Mode 2: append a GeoJSON Feature to pins/photos
    if(body.feature && body.geoTarget){
      const tgt = body.geoTarget === "photos" ? "photos" : "pins";
      const path = `data/${tgt}.geojson`;

      // Get current file (if exists)
      let sha = null, coll = { type:"FeatureCollection", features: [] };
      try{
        const cur = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(GH_BRANCH)}`).then(r=>r.json());
        sha = cur.sha;
        const buff = Buffer.from(cur.content, cur.encoding||"base64").toString("utf8");
        coll = JSON.parse(buff);
        if(!Array.isArray(coll.features)) coll.features = [];
      }catch(e){ /* 404 ok -> fresh collection */ }

      coll.features.push(body.feature);

      const newContent = Buffer.from(JSON.stringify(coll,null,2), "utf8").toString("base64");
      const payload = { message:`feat: append ${tgt} feature`, content:newContent, branch:GH_BRANCH };
      if(sha) payload.sha = sha;

      await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
        method:"PUT",
        body: JSON.stringify(payload)
      });

      const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(GH_BRANCH)}/${path}`;
      return { statusCode:200, body: JSON.stringify({ ok:true, path, url:raw }) };
    }

    return { statusCode:400, body:"Bad Request: supply dataUrl... OR feature+geoTarget" };
  }catch(e){
    return { statusCode:500, body:`Server error: ${e.message||e}` };
  }
}
