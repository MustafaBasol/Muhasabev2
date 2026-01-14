import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AdminService } from '../admin/admin.service';
import type { AdminHeaderMap } from '../admin/utils/admin-token.util';
import { resolveAdminHeaders } from '../admin/utils/admin-token.util';
import type { Request } from 'express';

function sanitizePathSegment(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function safeFilenameBase(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function isAllowedImageMime(mime: string): boolean {
  return (
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/webp' ||
    mime === 'image/gif' ||
    mime === 'image/svg+xml'
  );
}

function extFromMime(mime: string | undefined): string {
  if (!mime) return '';
  switch (mime) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/svg+xml':
      return '.svg';
    default:
      return '';
  }
}

@Controller('admin/blog-assets')
export class AdminBlogAssetsController {
  constructor(private readonly adminService: AdminService) {}

  private resolveAdminToken(headers?: AdminHeaderMap): string {
    const { adminToken } = resolveAdminHeaders(headers);
    if (!adminToken) {
      throw new UnauthorizedException('Admin token required');
    }
    return adminToken;
  }

  private checkAdminAuth(headers?: AdminHeaderMap) {
    const adminToken = this.resolveAdminToken(headers);
    if (!this.adminService.isValidAdminToken(adminToken)) {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const rawFolder =
            (req?.query?.folder as string | undefined) ||
            (req?.query?.dir as string | undefined) ||
            'images';
          const folder = sanitizePathSegment(rawFolder) || 'images';

          const baseDir =
            process.env.BLOG_ASSETS_DIR ||
            join(process.cwd(), 'public', 'assets', 'blog');
          const dest = join(baseDir, folder);
          mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const base =
            (req?.query?.name as string | undefined) ||
            (req?.query?.slug as string | undefined) ||
            file?.originalname ||
            'image';

          const ext = extname(file.originalname || '').toLowerCase();
          const safeExt =
            ext === '.png' ||
            ext === '.jpg' ||
            ext === '.jpeg' ||
            ext === '.webp' ||
            ext === '.gif' ||
            ext === '.svg'
              ? ext
              : extFromMime(file?.mimetype);

          const stamp = Date.now();
          const safeBase = safeFilenameBase(base) || 'image';
          cb(null, `${safeBase}-${stamp}${safeExt}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        if (!file?.mimetype || !isAllowedImageMime(file.mimetype)) {
          return cb(new BadRequestException('Only image uploads are allowed') as any, false);
        }
        return cb(null, true);
      },
    }),
  )
  async upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers() headers?: AdminHeaderMap,
    @Query('folder') folderQuery?: string,
  ) {
    this.checkAdminAuth(headers);

    if (!file) {
      throw new BadRequestException('file is required');
    }

    const folder = sanitizePathSegment(folderQuery || 'images') || 'images';

    const path = `/assets/blog/${folder}/${encodeURIComponent(file.filename)}`;

    const publicBaseUrl = (process.env.PUBLIC_ASSETS_BASE_URL || '').trim();
    const baseFromEnv = publicBaseUrl ? publicBaseUrl.replace(/\/$/, '') : '';

    const xfProto = req.headers['x-forwarded-proto'];
    const xfHost = req.headers['x-forwarded-host'];
    const hostHeader = xfHost || req.headers['host'];
    const protocol =
      (Array.isArray(xfProto) ? xfProto[0] : xfProto) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).protocol ||
      'http';
    const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
    const baseFromRequest = host ? `${protocol}://${host}` : '';

    const base = baseFromEnv || baseFromRequest;
    const url = base ? `${base}${path}` : path;

    return {
      ok: true,
      file: {
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      },
      path,
      url,
    };
  }
}
