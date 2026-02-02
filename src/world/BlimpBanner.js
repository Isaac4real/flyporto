import * as THREE from 'three';

function createBrandingTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const panelX = 120;
  const panelY = 84;
  const panelW = canvas.width - panelX * 2;
  const panelH = canvas.height - panelY * 2;
  const radius = 60;
  const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY);
  panelGradient.addColorStop(0, '#0f172a');
  panelGradient.addColorStop(0.5, '#111c35');
  panelGradient.addColorStop(1, '#0f172a');

  ctx.fillStyle = panelGradient;
  ctx.beginPath();
  ctx.moveTo(panelX + radius, panelY);
  ctx.lineTo(panelX + panelW - radius, panelY);
  ctx.quadraticCurveTo(panelX + panelW, panelY, panelX + panelW, panelY + radius);
  ctx.lineTo(panelX + panelW, panelY + panelH - radius);
  ctx.quadraticCurveTo(panelX + panelW, panelY + panelH, panelX + panelW - radius, panelY + panelH);
  ctx.lineTo(panelX + radius, panelY + panelH);
  ctx.quadraticCurveTo(panelX, panelY + panelH, panelX, panelY + panelH - radius);
  ctx.lineTo(panelX, panelY + radius);
  ctx.quadraticCurveTo(panelX, panelY, panelX + radius, panelY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(panelX + 80, panelY + panelH - 40);
  ctx.lineTo(panelX + panelW - 80, panelY + panelH - 40);
  ctx.stroke();

  // Title text
  ctx.font = "900 220px 'Bebas Neue', 'Oswald', 'Arial Black', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f8fafc';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 6);

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#0b1220';
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  if ('colorSpace' in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function curvePanelGeometry(geometry, radius = 22, inset = 0.6) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const clampedY = Math.max(-radius, Math.min(radius, y));
    const surfaceX = Math.sqrt(Math.max(0, radius * radius - clampedY * clampedY));
    position.setX(i, surfaceX - radius - inset);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function createBlimpBanner({ text = 'www.grw.ai' } = {}) {
  const group = new THREE.Group();
  group.name = 'grw-blimp-banner';

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7f7f4,
    roughness: 0.32,
    metalness: 0.08
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6b56f,
    roughness: 0.32,
    metalness: 0.28
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.6,
    metalness: 0.2
  });

  const bodyRadius = 22;
  const bodyLength = 120;
  const bodyGeometry = new THREE.CapsuleGeometry(bodyRadius, bodyLength, 12, 24);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const stripeGeometry = new THREE.CylinderGeometry(bodyRadius + 0.6, bodyRadius + 0.6, 12, 40, 1, true);
  stripeGeometry.rotateX(Math.PI / 2);
  const stripeOffsets = [-24, 0, 24];
  stripeOffsets.forEach((offset) => {
    const stripe = new THREE.Mesh(stripeGeometry, accentMaterial);
    stripe.position.z = offset;
    group.add(stripe);
  });

  const finGeometry = new THREE.BoxGeometry(18, 1.6, 14);
  const finTop = new THREE.Mesh(finGeometry, accentMaterial);
  finTop.position.set(0, 18, bodyLength / 2 + 10);
  group.add(finTop);

  const finSideLeft = new THREE.Mesh(finGeometry, accentMaterial);
  finSideLeft.rotation.z = Math.PI / 2;
  finSideLeft.position.set(-18, 0, bodyLength / 2 + 10);
  group.add(finSideLeft);

  const finSideRight = finSideLeft.clone();
  finSideRight.position.x = 18;
  group.add(finSideRight);

  const gondolaGeometry = new THREE.BoxGeometry(26, 7, 10);
  const gondola = new THREE.Mesh(gondolaGeometry, darkMaterial);
  gondola.position.set(0, -27, -8);
  group.add(gondola);

  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    emissive: 0x2563eb,
    emissiveIntensity: 1.0,
    roughness: 0.15,
    metalness: 0.2
  });
  const windowGeometry = new THREE.BoxGeometry(18, 2, 1);
  const windowStrip = new THREE.Mesh(windowGeometry, windowMaterial);
  windowStrip.position.set(0, -24, -12);
  group.add(windowStrip);

  const tailRingGeometry = new THREE.TorusGeometry(bodyRadius * 0.78, 1.4, 12, 40);
  const tailRing = new THREE.Mesh(tailRingGeometry, accentMaterial);
  tailRing.position.set(0, 0, bodyLength / 2 + 18);
  tailRing.rotation.x = Math.PI / 2;
  group.add(tailRing);

  const brandingTexture = createBrandingTexture(text);
  const brandingMaterial = new THREE.MeshStandardMaterial({
    map: brandingTexture,
    transparent: true,
    alphaTest: 0.02,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.12
  });

  const panelWidth = 150;
  const panelHeight = 32;
  const panelInset = 0.6;
  const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight, 40, 12);
  panelGeometry.rotateY(Math.PI / 2);
  curvePanelGeometry(panelGeometry, bodyRadius, panelInset);

  const panelOffset = bodyRadius + panelInset;
  const leftPanel = new THREE.Mesh(panelGeometry, brandingMaterial);
  leftPanel.position.set(-panelOffset, 2, 0);
  leftPanel.rotation.y = Math.PI;
  group.add(leftPanel);

  const rightPanel = new THREE.Mesh(panelGeometry.clone(), brandingMaterial);
  rightPanel.position.set(panelOffset, 2, 0);
  group.add(rightPanel);

  // Trailing banner behind the blimp for high-visibility branding
  const bannerWidth = 240;
  const bannerHeight = 50;
  const bannerGeometry = new THREE.PlaneGeometry(bannerWidth, bannerHeight, 1, 1);
  // Align banner width with blimp length (local Z axis)
  bannerGeometry.rotateY(Math.PI / 2);
  const bannerFront = new THREE.Mesh(bannerGeometry, brandingMaterial);
  const bannerBack = new THREE.Mesh(bannerGeometry, brandingMaterial);
  bannerBack.rotation.y = Math.PI;
  const bannerGroup = new THREE.Group();
  bannerGroup.add(bannerFront);
  bannerGroup.add(bannerBack);
  bannerGroup.position.set(0, -10, bodyLength / 2 + 150);
  group.add(bannerGroup);

  const cableMaterial = darkMaterial;
  const cableGeometry = new THREE.CylinderGeometry(0.28, 0.28, 130, 10);
  cableGeometry.rotateX(Math.PI / 2);
  const cableOffsets = [
    [-10, -6, bodyLength / 2 + 30],
    [10, -6, bodyLength / 2 + 30]
  ];
  cableOffsets.forEach(([x, y, z]) => {
    const cable = new THREE.Mesh(cableGeometry, cableMaterial);
    cable.position.set(x, y, z + 70);
    cable.rotation.z = 0.1;
    group.add(cable);
  });

  return { group };
}
