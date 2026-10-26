// Read a single assistant-transcribed hand from stdin. Never writes private hands to disk.
import {readAssistantHand} from '../src/assistantImport.js';
import {makeShareHand,reviewLink} from '../src/share.js';
const base=process.argv[2]||'https://emily883810-cpu.github.io/poker/';
try{
 let input='',bytes=0;process.stdin.setEncoding('utf8');
 for await(const chunk of process.stdin){bytes+=Buffer.byteLength(chunk,'utf8');if(bytes>1000000)throw Error('一次只處理一手，結果上限 1 MB。');input+=chunk;}
 const hand=readAssistantHand(input);
 // Original source and private notes are excluded; player names are anonymised.
 const link=reviewLink(base,makeShareHand(hand));
 // Verify the generated fragment through the same reader before returning it.
 readAssistantHand(link);
 process.stdout.write(link+'\n');
}catch(e){process.stderr.write(`未建立重播連結：${e.message}\n`);process.exitCode=1;}
