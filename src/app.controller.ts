import { Controller, Get, Redirect, Res } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#10b981"/>
  <path fill="white" d="M6 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H12l-4 4v-4H8a2 2 0 0 1-2-2V8z"/>
  <circle cx="11" cy="14" r="1.8" fill="#10b981"/>
  <circle cx="16" cy="14" r="1.8" fill="#10b981"/>
  <circle cx="21" cy="14" r="1.8" fill="#10b981"/>
</svg>`;

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @Redirect('/dashboard', 302)
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('favicon.svg')
  favicon(@Res() res: Response) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(FAVICON_SVG);
  }
}
