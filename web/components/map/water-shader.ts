// Shared by the world map canvas and the region water canvas so the sea is
// literally the same material everywhere. uUvScale lets a non-square plane
// reproduce the world's on-screen tile density (the world passes (1, 1)).
export const WATER_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const WATER_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uBaseColor;
  uniform sampler2D uNormal;
  uniform sampler2D uRoughness;
  uniform sampler2D uFlow;
  uniform float uTime;
  uniform float uMotion;
  uniform float uNormalStrength;
  uniform vec2 uUvScale;
  varying vec2 vUv;

  void main() {
    float time = uTime * uMotion;
    vec2 suv = vUv * uUvScale;

    // Keep the watercolour crisp and pretty — only a very slow drift so it never
    // looks frozen, and NO refraction warping (that muddied the artwork).
    vec3 water = texture2D(uBaseColor, suv * 16.0 + vec2(time * 0.0022, time * 0.0013)).rgb;

    // Movement comes from light, not from distorting the texture: an animated
    // surface normal drives a travelling sparkle.
    vec2 nUvA = suv * 22.0 + vec2(time * 0.012, time * 0.007);
    vec2 nUvB = vec2(uUvScale.x - suv.x, suv.y) * 28.0 + vec2(-time * 0.009, time * 0.013);
    vec3 normal = normalize(mix(
      texture2D(uNormal, nUvA).rgb * 2.0 - 1.0,
      texture2D(uNormal, nUvB).rgb * 2.0 - 1.0,
      0.5
    ));
    vec3 lightDir = normalize(vec3(-0.26, 0.4, 1.0));
    float roughness = texture2D(uRoughness, nUvB * 0.8).r;
    float glint = pow(max(dot(normal, lightDir), 0.0), 9.0) * (1.0 - roughness);

    // Soft caustic light bands slowly drifting across the sea — the main, calm
    // sense of a living surface.
    float c1 = texture2D(uFlow, suv * 4.0 + vec2(time * 0.006, time * 0.0022)).r;
    float c2 = texture2D(uFlow, suv * 6.5 + vec2(-time * 0.004, time * 0.005)).r;
    float caustic = pow(max(c1 * c2, 0.0), 1.4);

    vec3 paperSea = vec3(0.890, 0.949, 0.937);
    vec3 color = mix(paperSea, water, 0.55);
    color += glint * 0.10 * (0.6 + uNormalStrength);
    color += caustic * 0.09;
    color += (c1 - 0.5) * 0.045;
    gl_FragColor = vec4(color, 1.0);
  }
`;
