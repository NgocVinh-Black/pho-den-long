/** Lỗi nghiệp vụ có mã HTTP, thông điệp hiển thị được cho người chơi. */
export class GameError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export const notFound = (what: string) => new GameError(`Không tìm thấy ${what}`, 404);
