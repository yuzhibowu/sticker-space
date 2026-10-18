import {expect,it} from 'vitest';
import {CursorInput} from './cursorInput';
it('touch and Pencil suppress compatibility mouse and menu hover; real mouse movement restores cursor',()=>{
 const input=new CursorInput();expect(input.accepts({pointerType:'mouse',type:'pointerover'},0,true)).toBe(false);
 expect(input.accepts({pointerType:'mouse',type:'pointermove'},1,true)).toBe(true);
 input.touch(10);expect(input.accepts({pointerType:'mouse',type:'pointerdown'},20,true)).toBe(false);
 expect(input.accepts({type:'click'},30,true)).toBe(false);
 expect(input.accepts({pointerType:'mouse',type:'pointerover'},1000,true)).toBe(false);
 expect(input.accepts({pointerType:'mouse',type:'pointermove'},1001,true)).toBe(true);
 expect(input.accepts({pointerType:'pen'},1002,true)).toBe(false);
 expect(input.accepts({pointerType:'mouse',type:'pointermove'},3000,false)).toBe(false);
});
