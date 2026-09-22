// The player's visible body (brief §6: visible, in period dress, with a shadow). PLACEHOLDER (Phase 1): a simple
// figure in undyed wool tunic and trousers colours (riding-dress silhouette, C). Replaced by a rigged, dressed
// character in Phase 3/5. Flagged in the dev overlay.
import * as THREE from 'three/webgpu';
export function makePlayerBody(): THREE.Group {
  const g = new THREE.Group(); g.name = 'player-body';
  g.userData = { tier: 'C', src: 'RECON', placeholder: true, note: 'placeholder body: proportions only; dress per MATERIAL_CULTURE in Phase 3' };
  const wool = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.55, 0.47, 0.36, THREE.SRGBColorSpace), roughness: 0.95 });
  const trouser = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.36, 0.3, 0.24, THREE.SRGBColorSpace), roughness: 0.95 });
  const skin = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.55, 0.4, 0.3, THREE.SRGBColorSpace), roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.72, 12), wool); torso.position.y = 1.12;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.3, 12), wool); skirt.position.y = 0.72;
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.8, 8).translate(0, -0.4, 0), trouser); legL.position.set(-0.1, 0.8, 0); // pivot at hip
  const legR = legL.clone(); legR.position.x = 0.1;
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.62, 8).translate(0, -0.31, 0), wool); armL.position.set(-0.27, 1.46, 0.02); // pivot at shoulder armL.rotation.z = 0.08;
  const armR = armL.clone(); armR.position.x = 0.27; armR.rotation.z = -0.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin); head.position.y = 1.6;
  g.add(torso, skirt, legL, legR, armL, armR, head);
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  head.visible = false; // camera sits inside the head; the head still casts a shadow via a shadow-only copy
  const headShadow = head.clone(); headShadow.visible = true; (headShadow.material as THREE.Material) = skin.clone(); (headShadow.material as THREE.Material).colorWrite = false; (headShadow.material as THREE.Material).depthWrite = false;
  g.add(headShadow);
  (g as any).legs = [legL, legR]; (g as any).arms = [armL, armR];
  return g;
}
export function animateBody(g: THREE.Group, phase: number, speed: number) {
  const [l, r] = (g as any).legs as THREE.Mesh[], [al, ar] = (g as any).arms as THREE.Mesh[];
  const a = Math.min(1, speed / 1.35) * 0.45 * Math.sin(phase);
  l.rotation.x = a; r.rotation.x = -a; al.rotation.x = -a * 0.7; ar.rotation.x = a * 0.7;
}
