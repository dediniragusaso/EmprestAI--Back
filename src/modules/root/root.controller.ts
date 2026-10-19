import { Controller, Get } from '@nestjs/common';

// Rota raiz, fora do prefixo /v1 (ver bootstrap.ts).
@Controller()
export class RootController {
  @Get()
  root() {
    return { service: 'EMPREST.AI', api: '/v1' };
  }
}
