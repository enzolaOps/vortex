/**
 * Apps de áudio da casca. Ausente no navegador: lá o som é o da superfície, tudo ou nada.
 */

export type AppDeAudio = { readonly id: string; readonly nome: string };

export type PonteDoMixer = {
	readonly listar: () => Promise<AppDeAudio[]>;
	readonly definir: (ids: string[]) => Promise<boolean>;
	readonly iniciar: () => Promise<boolean>;
	readonly parar: () => Promise<void>;
	readonly assinar: (ouvinte: (bloco: Uint8Array) => void) => () => void;
};

declare global {
	interface Window {
		readonly vortexMixer?: PonteDoMixer;
	}
}

export function ponteDoMixer(): PonteDoMixer | undefined {
	if (typeof window === "undefined") return undefined;
	const ponte = window.vortexMixer;
	if (!ponte) return undefined;
	return typeof ponte.listar === "function" &&
		typeof ponte.definir === "function"
		? ponte
		: undefined;
}
