require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const qrcode = require('qrcode');
const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA = path.join(__dirname,'patients.json');
const FRONT = path.join(__dirname,'..','frontend');
const QR_DIR = path.join(FRONT,'qr');
if(!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR,{recursive:true});

let twilioClient = null;
if(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN){
  try{ const Twilio = require('twilio'); twilioClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); console.log('Twilio ready'); }
  catch(e){ console.warn('Twilio load error', e.message); }
}

function loadDB(){ return JSON.parse(fs.readFileSync(DATA)); }
function saveDB(db){ fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }

app.get('/api/patient/:id', (req,res)=>{
  const db = loadDB(); const id = req.params.id;
  if(!db[id]) return res.status(404).json({success:false});
  res.json({success:true,patient:db[id]});
});

app.post('/api/result', async (req,res)=>{
  try{
    const { id, results } = req.body;
    if(!id || !results) return res.status(400).json({success:false,msg:'Missing'});
    const db = loadDB();
    if(!db[id]) return res.status(404).json({success:false,msg:'Unknown'});
    db[id].results = results;
    saveDB(db);
    const link = `${process.env.BASE_URL.replace(/\/$/,'')}/report.html?id=${encodeURIComponent(id)}&token=${encodeURIComponent(db[id].token)}`;
    const qrPath = path.join(QR_DIR, `patient_${id}.png`);
    await qrcode.toFile(qrPath, link);
    if(twilioClient && process.env.TWILIO_NUMBER && db[id].phone){
      try{
        await twilioClient.messages.create({ from: process.env.TWILIO_NUMBER, to: `whatsapp:${db[id].phone}`, body: `Your lab result is ready. Open your secure link:\n${link}` });
        console.log('WhatsApp sent to', db[id].phone);
      }catch(e){ console.error('Twilio send error', e.message||e); }
    } else {
      console.log('Twilio not configured or phone missing; skipped send');
    }
    return res.json({ success:true, link, qr:`/qr/patient_${id}.png` });
  }catch(e){ console.error(e); return res.status(500).json({success:false}); }
});

// simple admin endpoint to list patients (no sensitive data)
app.get('/api/list', (req,res)=>{ const db = loadDB(); res.json({success:true, patients:Object.keys(db).map(id=>({id, name: db[id].name}))}); });

// serve frontend static files
app.use(express.static(FRONT));

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log('Server running on port', PORT));