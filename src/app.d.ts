import type { Post } from "./lib/gelbooru";
import type { TeleportedThumbnail } from "./lib/Utils";
import type { PageServerData } from "./routes/post/[id]/$types";

declare global {
	namespace App {
		interface PageState {
			expandedPost?: {
				post: Post,
				extra: NonNullable<PageServerData["extra"]> | undefined,
				storedScrollX: number,
				storedScrollY: number,
				from: string
			},
			showSigninModal?: boolean
		}

		type UserCredentials = {
			userId: string,
			passHash: string
		};
		interface Locals {
			userCredentials?: UserCredentials
		}
	}
}

export { };
