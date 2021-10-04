const recorderButton = document.getElementById('recorder-button'); // the button to start and stop the recording
const recorderButtonDiv = document.getElementById('recorder-button-div'); // the styled div that looks like a record button 
const initStream = document.getElementById('init-stream');
const initAudio = document.getElementById('init-audio');
let audioElement = document.getElementById('audio'); // the audio element that we will feed our recording to
let webAudioRecorder; // our WebAudioRecorder.js recorder yet to be instantiated
let currentlyRecording = false; // a boolean to keep track of whether recording is taking place
let getUserMediaStream; // our stream from getUserMedia

let source = null;
let playWhileLoadingDuration = 0;
let startAt = 0;
let audioBuffer = null;
let activeSource = null;

let duration = 0;

const local = 'http://localhost:3333';
const socket = io(local, { transports : ['websocket'] });

const getAudioContext =  () => {
  AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContext();

  return { audioContext };
};

const { audioContext } = getAudioContext();
const gainNode = audioContext.createGain();

// HEADER FUNCTIONS
const concat = (buffer1, buffer2) => {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);

  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);

  return tmp.buffer;
};

const appendBuffer = (buffer1, buffer2, context) => {
  const numberOfChannels = Math.min( buffer1.numberOfChannels, buffer2.numberOfChannels );
  const tmp = context.createBuffer( numberOfChannels, (buffer1.length + buffer2.length), buffer1.sampleRate );
  for (let i=0; i<numberOfChannels; i++) {
    const channel = tmp.getChannelData(i);
    channel.set( buffer1.getChannelData(i), 0);
    channel.set( buffer2.getChannelData(i), buffer1.length);
  }
  return tmp;
};

const withWaveHeader = (data, numberOfChannels, sampleRate) => {
  const header = new ArrayBuffer(44);

  const d = new DataView(header);

  d.setUint8(0, "R".charCodeAt(0));
  d.setUint8(1, "I".charCodeAt(0));
  d.setUint8(2, "F".charCodeAt(0));
  d.setUint8(3, "F".charCodeAt(0));

  d.setUint32(4, data.byteLength / 2 + 44, true);

  d.setUint8(8, "W".charCodeAt(0));
  d.setUint8(9, "A".charCodeAt(0));
  d.setUint8(10, "V".charCodeAt(0));
  d.setUint8(11, "E".charCodeAt(0));
  d.setUint8(12, "f".charCodeAt(0));
  d.setUint8(13, "m".charCodeAt(0));
  d.setUint8(14, "t".charCodeAt(0));
  d.setUint8(15, " ".charCodeAt(0));

  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, numberOfChannels, true);
  d.setUint32(24, sampleRate, true);
  d.setUint32(28, sampleRate * 1 * 2);
  d.setUint16(32, numberOfChannels * 2);
  d.setUint16(34, 16, true);

  d.setUint8(36, "d".charCodeAt(0));
  d.setUint8(37, "a".charCodeAt(0));
  d.setUint8(38, "t".charCodeAt(0));
  d.setUint8(39, "a".charCodeAt(0));
  d.setUint32(40, data.byteLength, true);

  return concat(header, data);
};

initStream.addEventListener('click', () => {
  /* try { */
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
        console.log('Source', source);
        playWhileLoadingDuration = source.buffer.duration;
        startAt = Date.now();
        playWhileLoading();
      }
    }, 500);
    
    const stop = () => source && source.stop(0);
    const setVolume = (level) =>
      gainNode.gain.setValueAtTime(level, audioContext.currentTime);
  /* } catch (e) {
    reject(e)
  } */
  // create audio source
  source = audioContext.createBufferSource();
  source.buffer = audioBuffer;

  source.connect(audioContext.destination);

  // source.connect(gainNode);
  // gainNode.connect(audioContext.destination);

  source.start();
  
  socket.emit('track', (e) => {});
   ss(socket).on('track-stream', (stream, { stat }) => {
     console.log('Stream Id:  ', stream.id);
     // console.log('Stat:  ', stat)

     currentlyRecording = true;
     // if this is a subsequent recording, hide the HTML audio element
     audioElement.controls = false;
     // change the div inside the button so that it looks like a stop button
     recorderButtonDiv.style.backgroundColor = 'rgba(0,0,0,.3)';
     recorderButtonDiv.style.borderRadius = 0;
     // set this to stream so that we can access it outside the scope of the promise 
     // when we need to stop the stream created by getUserMedia 
     getUserMediaStream = stream;
     
    // let inter = ss.createBlobReadStream(stream); 
     // the AudioContext that will handle our audio stream
     // if you're in Safari or an older Chrome, you can't use the regular audio context so provide this line to use webkitAudioContext
     /* let AudioContext = window.AudioContext ||  window.webkitAudioContext;
     let audioContext = new AudioContext(); */
     // an audio node that we can feed to a new WebAudioRecorder so we can record/encode the audio data
     //  let source = audioContext.createMediaStreamSource(inter);
     // the creation of the recorder with its settings:
     webAudioRecorder = new WebAudioRecorder(source, {
       // workerDir: the directory where the WebAudioRecorder.js file lives
       workerDir: 'web_audio_recorder_js/',
       // encoding: type of encoding for our recording ('mp3', 'ogg', or 'wav')
       encoding: 'mp3',
       options: {
         // encodeAfterRecord: our recording won't be usable unless we set this to true
         encodeAfterRecord: true,
         // mp3: bitRate: '160 is default, 320 is max quality'
         mp3: { bitRate: '320' }
       }
     });



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
       // changeAudionState({ loadingProcess: rate, startedAt: startAt });
        console.log(rate);
       if(rate >= 100) {
         clearInterval(whileLoadingInterval);
         audioBuffer = source.buffer;
         const inSec = (Date.now() - startAt) / 1000;
         console.log(activeSource);
         activeSource.stop();
         play(inSec);
         resolve({ play, stop, setVolume });
       }
       isData = true;
       // first time load
       if(isData && rate === loadRate) {
         duration = (100 / loadRate) * audioBufferChunk.duration;
         //setDuration(duration)
       }
     });
   });
});
// listen for clicks on the record button to begin the stream and recording
initAudio.addEventListener('click', () => {
  // the options object determining what media type(s) to capture
  let options = { 'audio': true, 'video': false };  
  // only start the recording stream if there is not another recording in progress
  if (currentlyRecording === false) {
    // the built-in method for capturing audio/video from the user's device
    // pass in the media capture options object and ask for permission to access the microphone
    navigator.mediaDevices.getUserMedia(options)
    .then(stream => {

      currentlyRecording = true;
      // if this is a subsequent recording, hide the HTML audio element
      audioElement.controls = false;
      // change the div inside the button so that it looks like a stop button
      recorderButtonDiv.style.backgroundColor = 'rgba(0,0,0,.3)';
      recorderButtonDiv.style.borderRadius = 0;
      // set this to stream so that we can access it outside the scope of the promise 
      // when we need to stop the stream created by getUserMedia 
      getUserMediaStream = stream;
      // the AudioContext that will handle our audio stream
      // if you're in Safari or an older Chrome, you can't use the regular audio context so provide this line to use webkitAudioContext
      let AudioContext = window.AudioContext ||  window.webkitAudioContext;
      let audioContext = new AudioContext();
      // an audio node that we can feed to a new WebAudioRecorder so we can record/encode the audio data
      let source = audioContext.createMediaStreamSource(stream);
      // the creation of the recorder with its settings:
      webAudioRecorder = new WebAudioRecorder(source, {
        // workerDir: the directory where the WebAudioRecorder.js file lives
        workerDir: 'web_audio_recorder_js/',
        // encoding: type of encoding for our recording ('mp3', 'ogg', or 'wav')
        encoding: 'mp3',
        options: {
          // encodeAfterRecord: our recording won't be usable unless we set this to true
          encodeAfterRecord: true,
          // mp3: bitRate: '160 is default, 320 is max quality'
          mp3: { bitRate: '320' }
        }
      });
      // the method that fires when the recording finishes (triggered by webAudioRecorder.finishRecording() below)
      // the blob is the encoded audio file
      webAudioRecorder.onComplete = (webAudioRecorder, blob) => {
        // create a temporary URL that we can use as the src attribute for our audio element (audioElement)
        let audioElementSource = window.URL.createObjectURL(blob);
        // set this URL as the src attribute of our audio element
        audioElement.src = audioElementSource;
        // add controls so we can see the audio element on the page
        audioElement.controls = true;
        // reset the styles of the button's child div to look like a record button
        recorderButtonDiv.style.backgroundColor = 'red';
        recorderButtonDiv.style.borderRadius = '50%';
      }
      // handles and logs any errors that occur during the encoding/recording process
      webAudioRecorder.onError = (webAudioRecorder, err) => {
          console.error(err);
      }
      // method that initializes the recording
      webAudioRecorder.startRecording();
    })
    // catch and log any errors in getUserMedia's promise
    .catch(err => {
        console.error(err);
    });
  }
  else {
    // set this to the array of audio tracks in our getUserMedia stream. In this case we only have one.
    let audioTrack = getUserMediaStream.getAudioTracks()[0];
    // stop that track and end the stream
    // this is not absolutely necessary, but it stops the browser streaming audio inbetween recordings so you should probably do it
    audioTrack.stop();
    // this finishes things up and calls webAudioRecorder.onComplete
    webAudioRecorder.finishRecording();
    currentlyRecording = false;
  }
});