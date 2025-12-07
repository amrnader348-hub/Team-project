require('dotenv').config();
const axios = require('axios');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const portPath = process.env.ARDUINO_PORT;
const baud = parseInt(process.env.ARDUINO_BAUD || '9600', 10);
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 4000}`;
if(!portPath){ console.error('Set ARDUINO_PORT in .env'); process.exit(1); }
const port = new SerialPort.SerialPort({ path: portPath, baudRate: baud, autoOpen:false });
const parser = port.pipe(new Readline({ delimiter: '\n' }));
port.open(err=>{ if(err) return console.error('Error opening port:', err.message); console.log('Serial opened', portPath); });
parser.on('data', async line=>{
  const text = line.trim();
  console.log('Serial:', text);
  if(text.startsWith('DONE:')){
    try{
      const parts = text.slice(5).split(',').map(s=>s.trim());
      const id = parts[0];
      const ABS = Number(parts[1]);
      const CONC = Number(parts[2]);
      const TRANS = Number(parts[3]);
      await axios.post(`${SERVER_URL}/api/result`, { id, results:{ ABS, CONC, TRANS } });
      console.log('Posted result for', id);
    }catch(e){ console.error('Post error', e.message||e); }
  }
});