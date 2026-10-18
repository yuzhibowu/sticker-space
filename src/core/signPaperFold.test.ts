import {expect,it} from 'vitest';
import {foldedSignPaper} from './signPaperFold';

it('a distant support consumes paper length instead of stretching a narrow strip',()=>{
 const columns=64,rows=32,width=1,height=.5,stride=columns+1;
 const heights=new Float64Array(stride*(rows+1));
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++)heights[j*stride+i]=i>columns*.7?.75:0;
 const folded=foldedSignPaper(heights,columns,rows,width,height)!;
 expect(folded).not.toBeNull();let steep=0;
 for(let j=0;j<=rows;j++)for(let i=0;i<columns;i++){
  const k=(j*stride+i)*3,dx=folded[k+3]-folded[k],dz=folded[k+5]-folded[k+2];
  expect(Math.hypot(dx,dz)).toBeLessThanOrEqual(width/columns+1e-9);
  if(dz>Math.abs(dx)*2)steep++;
 }
 expect(steep).toBeGreaterThan(rows);
 // There is not enough paper to attach to the far support: it folds up and
 // ends before reaching it, keeping the original material length.
 expect(folded[columns*3+2]).toBeLessThan(.4);
 expect(folded[columns*3]).toBeLessThan(.24);
});
it('shallow lettering relief retains its established projection',()=>{
 const heights=Float64Array.from({length:81},(_,i)=>i%9>=4?.04:0);
 expect(foldedSignPaper(heights,8,8,1,1)).toBeNull();
});
