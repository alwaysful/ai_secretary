import { Allow, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Grade } from './srs';
import { VocabService } from './vocab.service';

export class ImportDto {
  /** aura-vocab/1 JSON (객체 또는 카드 배열) */
  @Allow()
  data!: unknown;

  @IsOptional() @IsUUID()
  deckId?: string;

  @IsOptional() @IsString() @MaxLength(100)
  name?: string;
}

export class CreateDeckDto {
  @IsString() @MaxLength(100)
  name!: string;
}

export class DeckDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString() @MaxLength(20)
  language?: string;

  @IsOptional() @IsInt() @Min(0) @Max(9999)
  newPerDay?: number;

  @IsOptional() @IsInt() @Min(0) @Max(99999)
  reviewPerDay?: number;

  @IsOptional() @IsIn(['front', 'back'])
  direction?: 'front' | 'back';
}

export class ResetDto {
  @IsIn(['srs', 'round', 'all'])
  what!: 'srs' | 'round' | 'all';
}

export class GradeDto {
  @IsInt() @Min(1) @Max(4)
  grade!: number;
}

export class KnownDto {
  @IsBoolean()
  known!: boolean;
}

export class CorrectDto {
  @IsBoolean()
  correct!: boolean;
}

export class NextRoundDto {
  @IsOptional() @IsBoolean()
  unknownOnly?: boolean;
}

export class CardDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  front!: string;

  @IsString() @IsNotEmpty() @MaxLength(2000)
  back!: string;

  @IsOptional() @IsString() @MaxLength(2000)
  reading?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  example?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  exampleMeaning?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  note?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true })
  tags?: string[];
}

export class CardPatchDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000)
  front?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000)
  back?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  reading?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  example?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  exampleMeaning?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  note?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional() @IsBoolean()
  starred?: boolean;

  @IsOptional() @IsBoolean()
  known?: boolean;
}

/** 단어장. 인증 없음: HOST=127.0.0.1 유지. */
@Controller('vocab')
export class VocabController {
  constructor(private readonly vocab: VocabService) {}

  @Get('decks')
  list() {
    return this.vocab.list();
  }

  @Post('decks')
  create(@Body() dto: CreateDeckDto) {
    return this.vocab.create(dto.name);
  }

  @Post('import')
  import(@Body() dto: ImportDto) {
    return this.vocab.import(dto.data, { deckId: dto.deckId, name: dto.name });
  }

  @Get('decks/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.vocab.get(id);
  }

  @Patch('decks/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeckDto) {
    return this.vocab.update(id, dto);
  }

  @Delete('decks/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vocab.remove(id);
  }

  @Get('decks/:id/export')
  export(@Param('id', ParseUUIDPipe) id: string) {
    return this.vocab.export(id);
  }

  @Post('decks/:id/reset')
  reset(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetDto) {
    return this.vocab.reset(id, dto.what);
  }

  @Get('decks/:id/queue')
  queue(@Param('id', ParseUUIDPipe) id: string) {
    return this.vocab.queue(id);
  }

  @Post('cards/:id/review')
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GradeDto) {
    return this.vocab.review(id, dto.grade as Grade);
  }

  @Get('decks/:id/round')
  round(@Param('id', ParseUUIDPipe) id: string, @Query('shuffle') shuffle?: string) {
    return this.vocab.round(id, { shuffle: shuffle === '1' || shuffle === 'true' });
  }

  @Post('decks/:id/round/next')
  nextRound(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NextRoundDto) {
    return this.vocab.nextRound(id, !!dto.unknownOnly);
  }

  @Post('cards/:id/round')
  roundAnswer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: KnownDto) {
    return this.vocab.roundAnswer(id, dto.known);
  }

  @Get('decks/:id/quiz')
  quiz(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('n', new DefaultValuePipe(20), ParseIntPipe) n: number,
    @Query('dir') dir?: string,
    @Query('pool') pool?: string,
  ) {
    return this.vocab.quiz(id, {
      n: Math.min(100, Math.max(1, n)),
      dir: dir === 'bf' ? 'bf' : 'fb',
      pool: pool === 'wrong' || pool === 'starred' || pool === 'unknown' ? pool : 'all',
    });
  }

  @Post('cards/:id/quiz')
  quizAnswer(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CorrectDto) {
    return this.vocab.quizAnswer(id, dto.correct);
  }

  @Get('decks/:id/cards')
  cards(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip = 0,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take = 50,
  ) {
    return this.vocab.cards(id, { q, filter, skip: Math.max(0, skip), take: Math.min(200, Math.max(1, take)) });
  }

  @Post('decks/:id/cards')
  addCard(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CardDto) {
    return this.vocab.addCard(id, { ...dto, tags: dto.tags ?? [] });
  }

  @Patch('cards/:id')
  updateCard(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CardPatchDto) {
    return this.vocab.updateCard(id, dto);
  }

  @Delete('cards/:id')
  @HttpCode(204)
  removeCard(@Param('id', ParseUUIDPipe) id: string) {
    return this.vocab.removeCard(id);
  }

  @Get('decks/:id/stats')
  stats(@Param('id', ParseUUIDPipe) id: string, @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.vocab.stats(id, Math.min(90, Math.max(7, days)));
  }
}
