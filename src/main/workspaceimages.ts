import { nativeImage, type NativeImage } from 'electron';
import { ALL_SERVICES_IMAGE, acceptWorkspaceImages } from '../shared/workspaceimages.ts';

let images = new Map<string, NativeImage>();

// Drawn by the interface, which has the icons and the colours: nativeImage reads no SVG.
export function setWorkspaceImages(sent: unknown, workspaceIds: readonly string[]): void {
	images = new Map(Object.entries(acceptWorkspaceImages(sent, workspaceIds)).map(([id, dataURL]) => {
		const image = nativeImage.createEmpty();
		// twice the 16px a menu draws it at, so it stays sharp on a 2x screen
		image.addRepresentation({ scaleFactor: 2, dataURL });
		return [id, image];
	}));
}

export function workspaceImage(id: string | null): NativeImage | undefined {
	return images.get(id ?? ALL_SERVICES_IMAGE);
}
