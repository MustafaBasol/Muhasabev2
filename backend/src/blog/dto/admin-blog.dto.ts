import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BlogPostStatus } from '../entities/blog-post.entity';

export class CreateBlogPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  canonicalUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ogImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  keywords?: string;

  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @IsOptional()
  @IsString()
  jsonLd?: string;

  @IsOptional()
  @IsEnum(BlogPostStatus)
  status?: BlogPostStatus;
}

export class UpdateBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  contentMarkdown?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  canonicalUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ogImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  keywords?: string;

  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;

  @IsOptional()
  @IsString()
  jsonLd?: string;

  @IsOptional()
  @IsEnum(BlogPostStatus)
  status?: BlogPostStatus;
}
