import { ArgumentsHost, Catch, createParamDecorator, ExecutionContext, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { pickLang, translateMessage, type Lang } from '@app/common/i18n';

/** The caller's language, from the Accept-Language header the app sends ("ko" or "en"). */
export const ReqLang = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Lang => pickLang(ctx.switchToHttp().getRequest<Request>().headers['accept-language']),
);

/** Error messages in the caller's language. Validation errors without a translation get a general message. */
@Catch(HttpException)
export class TranslateErrorsFilter extends BaseExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const lang = pickLang(http.getRequest<Request>().headers['accept-language']);
    if (lang === 'en' || http.getResponse<Response>().headersSent) return super.catch(exception, host);

    const raw = exception.getResponse();
    const body: Record<string, unknown> =
      typeof raw === 'string' ? { statusCode: exception.getStatus(), message: raw } : { ...(raw as Record<string, unknown>) };
    const message = body.message;
    if (typeof message === 'string') {
      body.message = translateMessage(message, lang);
    } else if (Array.isArray(message)) {
      body.message = message.map((m) => {
        const translated = translateMessage(String(m), lang);
        return translated === m ? '입력한 내용을 확인해 주세요' : translated;
      });
    }
    http.getResponse<Response>().status(exception.getStatus()).json(body);
  }
}
