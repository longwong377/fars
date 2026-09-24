// @ts-nocheck
// Patched copy of three r186 examples/jsm/tsl/display/SSSNode.js (screen-space sun contact shadows; MIT, three.js authors;
// ASSET_LEDGER). PĀRSA changes (D-188):
// (1) no self-shadowing of a surface by itself. three's node marks a pixel shadowed when a depth sample along the
//     screen-space ray toward the sun lies 0…thickness in front of the ray. The ray starts on the surface, and the depth it
//     compares against is the NEAREST full-resolution texel to each (sub-pixel) sample point, so on any plane seen at a
//     slant (the courts, the ground, walls seen along their length) the texel's depth can lie up to half a texel's slope
//     in front of the ray: a few per cent of sunlit pixels came out shadowed, isolated, at a fixed screen density — the
//     "dark-speckle stamp" of the §8.2 rubric on every sunlit court, wall and ground (rubric items 1, 10). Now each sample's
//     depth is reconstructed at its own texel's centre (so a point of the receiver's plane lies exactly on that plane) and
//     counts as an occluder only if it stands more than `planeTol` (+ a fraction of the view distance) above the
//     receiver's plane, whose normal is taken from the depth buffer (the geometric normal: the G-buffer's normal carries
//     the procedural relief); the ray starts at the pixel's own texel centre.
// (2) sky pixels (reversed Z: depth 0) are left unshadowed and cast nothing.
import { RedFormat, RenderTarget, Vector2, RendererUtils, QuadMesh, TempNode, NodeMaterial, NodeUpdateType, UnsignedByteType } from 'three/webgpu';
import { reference, viewZToPerspectiveDepth, logarithmicDepthToViewZ, getScreenPosition, getViewPosition, float, Break, Loop, int, max, abs, If, interleavedGradientNoise, screenCoordinate, Fn, passTexture, uv, uniform, perspectiveDepthToViewZ, orthographicDepthToViewZ, vec2, lightPosition, lightTargetPosition, fract, rand, mix, context, floor, dot, normalize, cross, step } from 'three/tsl';

const _quadMesh = /*@__PURE__*/ new QuadMesh();
const _size = /*@__PURE__*/ new Vector2();
let _rendererState;

class SSSNode extends TempNode {
	static get type() { return 'SSSNode'; }
	constructor( depthNode, camera, mainLight ) {
		super( 'float' );
		this.depthNode = depthNode;
		this.maxDistance = uniform( 0.1, 'float' );
		this.thickness = uniform( 0.01, 'float' );
		this.shadowIntensity = uniform( 1.0, 'float' );
		this.quality = uniform( 0.5 );
		/** PĀRSA (D-188): an occluder must stand this far (m) above the receiver's plane, plus planeTolRel × view distance */
		this.planeTol = uniform( 0.01, 'float' );
		this.planeTolRel = uniform( 0.002, 'float' );
		this.resolutionScale = 1;
		this.updateBeforeType = NodeUpdateType.FRAME;
		this._cameraViewMatrix = uniform( camera.matrixWorldInverse );
		this._cameraProjectionMatrix = uniform( camera.projectionMatrix );
		this._cameraProjectionMatrixInverse = uniform( camera.projectionMatrixInverse );
		this._cameraNear = reference( 'near', 'float', camera );
		this._cameraFar = reference( 'far', 'float', camera );
		this._resolution = uniform( new Vector2() );
		this._fullResolution = uniform( new Vector2() ); // the depth texture's size (PĀRSA)
		this._mainLight = mainLight;
		this._camera = camera;
		this._sssRenderTarget = new RenderTarget( 1, 1, { depthBuffer: false, format: RedFormat, type: UnsignedByteType } );
		this._sssRenderTarget.texture.name = 'SSS';
		this._material = new NodeMaterial();
		this._material.name = 'SSS';
		this._textureNode = passTexture( this, this._sssRenderTarget.texture );
	}
	getTextureNode() { return this._textureNode; }
	setSize( width, height ) {
		this._fullResolution.value.set( width, height );
		width = Math.round( this.resolutionScale * width );
		height = Math.round( this.resolutionScale * height );
		this._resolution.value.set( width, height );
		this._sssRenderTarget.setSize( width, height );
	}
	updateBefore( frame ) {
		const { renderer } = frame;
		_rendererState = RendererUtils.resetRendererState( renderer, _rendererState );
		const size = renderer.getDrawingBufferSize( _size );
		this.setSize( size.width, size.height );
		_quadMesh.material = this._material;
		_quadMesh.name = 'SSS';
		renderer.setClearColor( 0xffffff, 1 );
		renderer.setRenderTarget( this._sssRenderTarget );
		_quadMesh.render( renderer );
		RendererUtils.restoreRendererState( renderer, _rendererState );
	}
	setup( builder ) {
		const reversed = builder.renderer.reversedDepthBuffer === true;
		const getViewZ = Fn( ( [ depth ] ) => this._camera.isPerspectiveCamera ? perspectiveDepthToViewZ( depth, this._cameraNear, this._cameraFar ) : orthographicDepthToViewZ( depth, this._cameraNear, this._cameraFar ) );
		const sampleDepth = ( uv ) => {
			const depth = this.depthNode.sample( uv ).r;
			if ( builder.renderer.logarithmicDepthBuffer === true ) {
				const viewZ = logarithmicDepthToViewZ( depth, this._cameraNear, this._cameraFar );
				return viewZToPerspectiveDepth( viewZ, this._cameraNear, this._cameraFar );
			}
			return depth;
		};
		// the centre of the full-resolution depth texel under a uv (PĀRSA)
		const texelCentre = ( u ) => floor( u.mul( this._fullResolution ) ).add( 0.5 ).div( this._fullResolution );
		const sss = Fn( () => {
			const uv0 = texelCentre( uv() ).toConst();
			const depth = sampleDepth( uv0 ).toVar();
			if ( reversed ) depth.lessThanEqual( 0.0 ).discard(); else depth.greaterThanEqual( 1.0 ).discard();
			const rayStartPosition = getViewPosition( uv0, depth, this._cameraProjectionMatrixInverse ).toVar( 'rayStartPosition' );
			// the receiver's geometric plane (PĀRSA): normal from the depth buffer, facing the camera
			// (of the two neighbours on each axis, the one nearer in depth: a silhouette edge does not bend the plane)
			const px = vec2( float( 1 ).div( this._fullResolution.x ), 0 ), py = vec2( 0, float( 1 ).div( this._fullResolution.y ) );
			const at = ( u ) => getViewPosition( u, sampleDepth( u ), this._cameraProjectionMatrixInverse );
			const pl = at( uv0.sub( px ) ), pr = at( uv0.add( px ) ), pb = at( uv0.sub( py ) ), pt = at( uv0.add( py ) );
			const useL = step( abs( pl.z.sub( rayStartPosition.z ) ), abs( pr.z.sub( rayStartPosition.z ) ) ), useB = step( abs( pb.z.sub( rayStartPosition.z ) ), abs( pt.z.sub( rayStartPosition.z ) ) );
			const dx = mix( pr.sub( rayStartPosition ), rayStartPosition.sub( pl ), useL ), dy = mix( pt.sub( rayStartPosition ), rayStartPosition.sub( pb ), useB );
			const nRaw = normalize( cross( dx, dy ) ).toVar();
			const nPlane = nRaw.mul( float( 1 ).sub( step( 0, dot( nRaw, rayStartPosition ) ).mul( 2 ) ) ).toConst(); // facing the camera
			const tol = this.planeTol.add( rayStartPosition.z.negate().mul( this.planeTolRel ) ).toConst();
			const rayDirection = this._cameraViewMatrix.transformDirection( lightPosition( this._mainLight ).sub( lightTargetPosition( this._mainLight ) ) ).toConst( 'rayDirection' );
			const rayEndPosition = rayStartPosition.add( rayDirection.mul( this.maxDistance ) ).toConst( 'rayEndPosition' );
			const d0 = uv0.mul( this._resolution ).toVar();
			const d1 = getScreenPosition( rayEndPosition, this._cameraProjectionMatrix ).mul( this._resolution ).toVar();
			const totalLen = d1.sub( d0 ).length().toVar();
			const xLen = d1.x.sub( d0.x ).toVar();
			const yLen = d1.y.sub( d0.y ).toVar();
			const totalStep = int( max( abs( xLen ), abs( yLen ) ).mul( this.quality.clamp() ) ).toConst();
			const xSpan = xLen.div( totalStep ).toVar();
			const ySpan = yLen.div( totalStep ).toVar();
			const noise = interleavedGradientNoise( screenCoordinate );
			const offset = fract( noise ).add( rand( uv() ) ).toConst( 'offset' );
			const occlusion = float( 0 ).toVar();
			Loop( totalStep, ( { i } ) => {
				const xy = vec2( d0.x.add( xSpan.mul( float( i ).add( offset ) ) ), d0.y.add( ySpan.mul( float( i ).add( offset ) ) ) ).toVar();
				If( xy.x.lessThan( 0 ).or( xy.x.greaterThan( this._resolution.x ) ).or( xy.y.lessThan( 0 ) ).or( xy.y.greaterThan( this._resolution.y ) ), () => { Break(); } );
				const uvS = texelCentre( xy.div( this._resolution ) ).toConst();
				const fragmentDepth = sampleDepth( uvS ).toConst();
				const fragmentViewZ = getViewZ( fragmentDepth ).toConst( 'fragmentViewZ' );
				// the ray at the sample texel's own screen position (PĀRSA: the texel centre, not the sub-pixel point)
				const s = uvS.mul( this._resolution ).sub( d0 ).length().div( totalLen.max( 1e-6 ) ).clamp().toVar();
				const rayPosition = mix( rayStartPosition, rayEndPosition, s );
				const depthDelta = rayPosition.z.sub( fragmentViewZ ).negate();
				// the sample's height above the receiver's plane (PĀRSA): a point of the same plane is not an occluder
				const pS = getViewPosition( uvS, fragmentDepth, this._cameraProjectionMatrixInverse );
				const above = dot( pS.sub( rayStartPosition ), nPlane );
				const skyS = reversed ? fragmentDepth.lessThanEqual( 0.0 ) : fragmentDepth.greaterThanEqual( 1.0 );
				If( depthDelta.greaterThan( 0 ).and( depthDelta.lessThan( this.thickness ) ).and( above.greaterThan( tol ) ).and( skyS.not() ), () => {
					occlusion.assign( this.shadowIntensity );
					Break();
				} );
			} );
			return occlusion.oneMinus();
		} );
		this._material.contextNode = context( builder.getSharedContext() );
		this._material.fragmentNode = sss();
		this._material.needsUpdate = true;
		return this._textureNode;
	}
	dispose() {
		super.dispose();
		this._sssRenderTarget.dispose();
		this._material.dispose();
	}
}
export default SSSNode;
export const sss = ( depthNode, camera, mainLight ) => new SSSNode( depthNode, camera, mainLight );
