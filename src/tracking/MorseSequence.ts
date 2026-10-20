const CODE: Record<string, string> = {
 A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',
 '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
};
export interface MorseStep { on: boolean; units: number; }
/** Standard International Morse spacing: intra-letter 1, letters 3, words 7 units. */
export function morseSequence(text: string): MorseStep[] {
 const words=text.toUpperCase().split(/\s+/).map(w=>Array.from(w).filter(c=>CODE[c]));
 const result:MorseStep[]=[];
 for(const word of words.filter(w=>w.length)){
  if(result.length)result.push({on:false,units:7});
  word.forEach((letter,index)=>{
   if(index)result.push({on:false,units:3});
   Array.from(CODE[letter]!).forEach((symbol,i)=>{
    if(i)result.push({on:false,units:1});
    result.push({on:true,units:symbol==='.'?1:3});
   });
  });
 }
 return result.length?result:[{on:true,units:1},{on:false,units:3}];
}
