export const oceanVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveScale;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vWaveHeight;

  float waveHeight(vec2 point) {
    float first = sin(dot(point, vec2(0.94, 0.34)) * 0.38 + uTime * 0.92) * 0.26;
    float second = sin(dot(point, vec2(-0.22, 0.98)) * 0.71 + uTime * 1.34 + 1.7) * 0.12;
    float third = sin(dot(point, vec2(0.62, -0.78)) * 1.18 + uTime * 1.82 + 4.1) * 0.055;
    return (first + second + third) * uWaveScale;
  }

  void main() {
    vec3 displaced = position;
    vec2 point = position.xz;
    float height = waveHeight(point);
    displaced.y += height;

    float epsilon = 0.12;
    float slopeX = waveHeight(point + vec2(epsilon, 0.0)) - waveHeight(point - vec2(epsilon, 0.0));
    float slopeZ = waveHeight(point + vec2(0.0, epsilon)) - waveHeight(point - vec2(0.0, epsilon));
    vec3 localNormal = normalize(vec3(-slopeX, epsilon * 2.0, -slopeZ));

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
    vWaveHeight = height;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const oceanFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uFoamMap;
  uniform vec3 uSunDirection;
  uniform vec3 uDeepColor;
  uniform vec3 uSurfaceColor;
  uniform vec3 uSkyColor;
  uniform vec3 uFogColor;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vWaveHeight;

  mat2 rotate2d(float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine);
  }

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float facing = clamp(dot(normal, viewDirection), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.0);

    float lightFacing = clamp(dot(normal, normalize(uSunDirection)), 0.0, 1.0);
    vec3 halfVector = normalize(normalize(uSunDirection) + viewDirection);
    float sunGlint = pow(max(dot(normal, halfVector), 0.0), 180.0) * 2.3;

    vec2 flow = vec2(uTime * 0.012, -uTime * 0.007);
    vec2 foamUvA = vWorldPosition.xz * 0.026 + flow;
    vec2 foamUvB = rotate2d(1.04) * vWorldPosition.xz * 0.047 - flow * 1.7;
    float foamA = texture2D(uFoamMap, foamUvA).r;
    float foamB = texture2D(uFoamMap, foamUvB).r;
    float crest = smoothstep(0.08, 0.36, vWaveHeight);
    float foam = smoothstep(0.46, 0.88, max(foamA, foamB * 0.62)) * (0.24 + crest * 0.96);

    float depthTint = smoothstep(-0.38, 0.32, vWaveHeight) * 0.28 + lightFacing * 0.12;
    vec3 water = mix(uDeepColor, uSurfaceColor, depthTint);
    vec3 reflection = mix(uSurfaceColor, uSkyColor, 0.72);
    vec3 color = mix(water, reflection, fresnel * 0.78);
    color += vec3(1.0, 0.78, 0.48) * sunGlint;
    color = mix(color, vec3(0.91, 0.97, 0.96), foam * 0.86);

    float distanceToCamera = length(cameraPosition.xz - vWorldPosition.xz);
    float fogAmount = smoothstep(90.0, 240.0, distanceToCamera);
    color = mix(color, uFogColor, fogAmount);

    gl_FragColor = vec4(color, 1.0);
  }
`;

