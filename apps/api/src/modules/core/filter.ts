import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DomainError } from './domain-error.js';

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<{ status: (code: number) => unknown; json: (b: unknown) => void }>();
    res.status(exception.httpStatus());
    res.json(exception.toResponse());
  }
}
