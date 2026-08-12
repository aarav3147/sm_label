// SM Labels - Interactive 3D Label Visualizer Engine (Three.js)

class LabelVisualizer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.currentMaterialType = 'woven';
    this.customText = 'SM LABELS';
    this.subText = 'EST. 2012 • BESPOKE CRAFT';
    this.labelColor = '#111111';
    this.textColor = '#d4af37';
    this.isRotating = true;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 450;

    // 1. Scene setup
    this.scene = new THREE.Scene();

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 1.2, 3.5);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    this.dirLight.position.set(4, 6, 4);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    this.backLight = new THREE.DirectionalLight(0xc5a059, 0.6);
    this.backLight.position.set(-4, -2, -3);
    this.scene.add(this.backLight);

    // 5. Create Objects
    this.createFabricBackground();
    this.createDynamicLabelMesh();

    // 6. Interaction listeners
    this.setupInteractivity();

    // 7. Animation Loop
    this.clock = new THREE.Clock();
    this.animate();

    // 8. Resize listener
    window.addEventListener('resize', () => this.onWindowResize());
  }

  createFabricBackground() {
    const geo = new THREE.PlaneGeometry(12, 12, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf5f3ee,
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    this.backgroundPlane = new THREE.Mesh(geo, mat);
    this.backgroundPlane.rotation.x = -Math.PI / 2;
    this.backgroundPlane.position.y = -0.6;
    this.backgroundPlane.receiveShadow = true;
    this.scene.add(this.backgroundPlane);
  }

  generateTextCanvasTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill Background
    ctx.fillStyle = this.labelColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border line if leather/woven
    ctx.strokeStyle = this.textColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    // Main Title
    ctx.fillStyle = this.textColor;
    ctx.font = 'bold 72px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.customText.toUpperCase(), canvas.width / 2, canvas.height / 2 - 25);

    // Subtitle
    ctx.font = '500 28px "Manrope", sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText(this.subText.toUpperCase(), canvas.width / 2, canvas.height / 2 + 55);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  createDynamicLabelMesh() {
    if (this.labelMesh) {
      this.scene.remove(this.labelMesh);
    }

    const textTexture = this.generateTextCanvasTexture();

    // Box Geometry for standard label
    const labelGeo = new THREE.BoxGeometry(2.2, 0.04, 1.1, 16, 4, 16);

    let labelMat;
    if (this.currentMaterialType === 'leather') {
      labelMat = new THREE.MeshStandardMaterial({
        map: textTexture,
        roughness: 0.6,
        metalness: 0.1,
        color: 0x9e6a38
      });
    } else if (this.currentMaterialType === 'satin') {
      labelMat = new THREE.MeshStandardMaterial({
        map: textTexture,
        roughness: 0.25,
        metalness: 0.2,
        color: 0xffffff
      });
    } else if (this.currentMaterialType === 'kraft') {
      labelMat = new THREE.MeshStandardMaterial({
        map: textTexture,
        roughness: 0.8,
        metalness: 0.0,
        color: 0xd6be96
      });
    } else {
      // Woven silk default
      labelMat = new THREE.MeshStandardMaterial({
        map: textTexture,
        roughness: 0.45,
        metalness: 0.35,
      });
    }

    this.labelMesh = new THREE.Mesh(labelGeo, labelMat);
    this.labelMesh.castShadow = true;
    this.labelMesh.position.set(0, 0, 0);
    this.scene.add(this.labelMesh);
  }

  updateLabelText(titleText, subtitleText) {
    if (titleText !== undefined) this.customText = titleText;
    if (subtitleText !== undefined) this.subText = subtitleText;
    this.createDynamicLabelMesh();
  }

  updateMaterial(type) {
    this.currentMaterialType = type;
    if (type === 'leather') {
      this.labelColor = '#6e431d';
      this.textColor = '#3b2007';
    } else if (type === 'satin') {
      this.labelColor = '#ffffff';
      this.textColor = '#111111';
    } else if (type === 'kraft') {
      this.labelColor = '#c4a675';
      this.textColor = '#2b2114';
    } else {
      // Woven
      this.labelColor = '#111111';
      this.textColor = '#c5a059';
    }
    this.createDynamicLabelMesh();
  }

  setupInteractivity() {
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const domElement = this.renderer.domElement;

    domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    domElement.addEventListener('mousemove', (e) => {
      if (!isDragging || !this.labelMesh) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      this.labelMesh.rotation.y += deltaX * 0.01;
      this.labelMesh.rotation.x += deltaY * 0.01;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Touch support for mobile
    domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });

    domElement.addEventListener('touchmove', (e) => {
      if (!isDragging || !this.labelMesh || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;

      this.labelMesh.rotation.y += deltaX * 0.01;
      this.labelMesh.rotation.x += deltaY * 0.01;

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    });

    domElement.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  onWindowResize() {
    if (!this.container || !this.renderer) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const elapsedTime = this.clock.getElapsedTime();

    if (this.labelMesh && this.isRotating) {
      this.labelMesh.rotation.y = Math.sin(elapsedTime * 0.5) * 0.35;
      this.labelMesh.position.y = Math.sin(elapsedTime * 1.2) * 0.08;
      this.labelMesh.rotation.z = Math.cos(elapsedTime * 0.4) * 0.05;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.LabelVisualizer3D = LabelVisualizer3D;
