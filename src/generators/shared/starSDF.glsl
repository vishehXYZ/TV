float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

mat2 rotate2d(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

/** N-pointed star/rosette SDF, classic Islamic star silhouette from one analytic curve. */
float starSDF(vec2 p, float n, float innerRatio, float sharpness) {
  float r = length(p);
  float theta = atan(p.y, p.x);
  float edgeR = mix(innerRatio, 1.0, pow(abs(cos(n * theta * 0.5)), sharpness));
  return r - edgeR;
}
