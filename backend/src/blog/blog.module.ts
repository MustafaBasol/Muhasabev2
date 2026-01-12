import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminModule } from '../admin/admin.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { BlogPost } from './entities/blog-post.entity';
import { BlogService } from './blog.service';
import { PublicBlogController } from './public-blog.controller';
import { AdminBlogController } from './admin-blog.controller';
import { BlogPagesController } from './blog-pages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost]), AdminModule, SiteSettingsModule],
  providers: [BlogService],
  controllers: [PublicBlogController, AdminBlogController, BlogPagesController],
  exports: [BlogService, TypeOrmModule],
})
export class BlogModule {}
