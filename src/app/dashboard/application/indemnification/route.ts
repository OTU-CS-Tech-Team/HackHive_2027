import { redirectToOwnFile } from '../own-file';

export function GET(request: Request) {
  return redirectToOwnFile('indemnification', request);
}
