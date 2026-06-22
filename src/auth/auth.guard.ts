import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        const res = context.switchToHttp().getResponse<Response>();
        const token = (req.cookies as Record<string, string>)?._wa_admin;
        if (!token || !this.authService.verifyToken(token)) {
            res.redirect('/login');
            return false;
        }
        return true;
    }
}
