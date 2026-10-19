import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from './auth.guard';

@Controller('me')
@UseGuards(AuthGuard)
export class MeController {
  @Get()
  me(@Req() req: AuthedRequest) {
    return { id: req.user.id, email: req.user.email };
  }
}
