import ss from 'socket.io-stream';
import socketClient from 'socket.io-client';
import { withWaveHeader, appendBuffer } from './wave-heared';

const url = 'http://localhost:3333'
const socket = socketClient(url, { transports : ['websocket'] });

const getAudioContext =  () => {
  AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();

  return { audioContext };
};

const loadFile = (props) => new Promise(async (resolve, reject) => {
 try {
   const { changeAudionState, setDuration } = props;
   let source = null;
   let playWhileLoadingDuration = 0;
   let startAt = 0;
   let audioBuffer = null;
   let activeSource = null;

   // create audio context
   const { audioContext } = getAudioContext();
   const gainNode = audioContext.createGain();

   const playWhileLoading = (duration = 0) => {
     source.connect(audioContext.destination);
     source.connect(gainNode);
     source.start(0, duration);
     activeSource = source;
   };

   const play = (resumeTime = 0) => {
     // create audio source
     source = audioContext.createBufferSource();
     source.buffer = audioBuffer;

     source.connect(audioContext.destination);

     source.connect(gainNode);
     gainNode.connect(audioContext.destination);

     //source.connect(analyser);
     source.start(0, resumeTime);
   };

   const whileLoadingInterval = setInterval(() => {
     if(startAt) {
       const inSec = (Date.now() - startAt) / 1000;
       if (playWhileLoadingDuration && inSec >= playWhileLoadingDuration) {
         playWhileLoading(playWhileLoadingDuration);
         playWhileLoadingDuration = source.buffer.duration
       }
     } else if(source) {
       playWhileLoadingDuration = source.buffer.duration;
       startAt = Date.now();
       playWhileLoading();
     }
   }, 500);

   const stop = () => source && source.stop(0);
   const setVolume = (level) =>
     gainNode.gain.setValueAtTime(level, audioContext.currentTime);

   // load file while socket
   socket.emit('track', (e) => {});
   ss(socket).on('track-stream', (stream, { stat }) => {
     let rate = 0;
     let isData = false;
     stream.on('data', async (data) => {
       const audioBufferChunk = await audioContext.decodeAudioData(withWaveHeader(data, 1, 6000));
       const newaudioBuffer = (source && source.buffer)
         ? appendBuffer(source.buffer, audioBufferChunk, audioContext)
         : audioBufferChunk;
       source = audioContext.createBufferSource();
       source.buffer = newaudioBuffer;

       const loadRate = (data.length * 100 ) / stat.size;
       rate = rate + loadRate;
       changeAudionState({ loadingProcess: rate, startedAt: startAt });

       if(rate >= 100) {
         clearInterval(whileLoadingInterval);
         audioBuffer = source.buffer;
         const inSec = (Date.now() - startAt) / 1000;
         activeSource.stop();
         play(inSec);
         resolve({ play, stop, setVolume });
       }
       isData = true;
       // first time load
       if(isData && rate === loadRate) {
         const duration = (100 / loadRate) * audioBufferChunk.duration;
         setDuration(duration)
       }
     });
   });
 } catch (e) {
   reject(e)
 }
});

export { getAudioContext, loadFile }
