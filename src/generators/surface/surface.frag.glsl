uniform sampler2D uMask;
uniform vec2 uMaskResolution;
uniform float uAspect;
uniform float uHasMask;
uniform float uTime;
uniform float uEnergy;
uniform float uStyle;
uniform vec3 uPalette[5];
varying vec2 vStagePos;
#include ../shared/maskSample.glsl;
void main() {
 float body = uHasMask > 0.5 ? smoothstep(0.35,0.65,sampleMask(vStagePos)) : 0.0;
 vec2 p = vStagePos;
 float lines = 1.0-step(0.10,fract(p.x*25.0 + sin(p.y*3.0+uTime)*uEnergy*0.3));
 vec2 cell = fract(p*7.0+vec2(0.0,uTime*0.08))-0.5;
 float dots = 1.0-step(0.14,length(cell));
 float cross = max(1.0-step(0.035,abs(cell.x)),1.0-step(0.035,abs(cell.y)));
 vec3 color = mix(uPalette[1],uPalette[3],0.5+0.5*sin(p.y*4.0+uTime));
 if (uStyle < 0.5) gl_FragColor = vec4(color,lines*(0.25+body*0.75));
 else if (uStyle < 1.5) gl_FragColor = vec4(mix(vec3(1.0),mix(vec3(0.015),color,body),dots),1.0);
 else if (uStyle < 2.5) gl_FragColor = vec4(mix(vec3(0.02),color,body),mix(lines,dots,body));
 else gl_FragColor = vec4(mix(color,vec3(0.015),body),mix(dots,cross,body));
}
