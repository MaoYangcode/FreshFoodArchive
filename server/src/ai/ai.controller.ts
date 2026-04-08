import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { AiService } from './ai.service'

const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_AUDIO_SIZE = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
])
const ALLOWED_AUDIO_EXT = ['.wav', '.mp3', '.m4a', '.aac', '.webm']

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('recognize-ingredient')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  async recognizeIngredient(@UploadedFile() file: any) {
    if (!file) {
      return { code: 10011, message: '图片文件为空', data: null }
    }
    if (!ALLOWED_TYPES.has(`${file.mimetype || ''}`.toLowerCase())) {
      return { code: 10012, message: '仅支持 jpg/jpeg/png/webp', data: null }
    }
    if (Number(file.size || 0) > MAX_IMAGE_SIZE) {
      return { code: 10012, message: '图片大小不能超过 8MB', data: null }
    }

    try {
      const ingredients = await this.aiService.recognizeIngredientFromImage(file)
      return { code: 0, message: 'ok', data: { ingredients } }
    } catch (error: any) {
      return {
        code: 10013,
        message: error?.message || '图片识别失败',
        data: null,
      }
    }
  }

  @Post('recognize-receipt')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
    }),
  )
  async recognizeReceipt(@UploadedFile() file: any) {
    if (!file) {
      return { code: 10031, message: '图片文件为空', data: null }
    }
    if (!ALLOWED_TYPES.has(`${file.mimetype || ''}`.toLowerCase())) {
      return { code: 10032, message: '仅支持 jpg/jpeg/png/webp', data: null }
    }
    if (Number(file.size || 0) > MAX_IMAGE_SIZE) {
      return { code: 10032, message: '图片大小不能超过 8MB', data: null }
    }

    try {
      const ingredients = await this.aiService.recognizeReceiptFromImage(file)
      return { code: 0, message: 'ok', data: { ingredients } }
    } catch (error: any) {
      return {
        code: 10033,
        message: error?.message || '小票识别失败',
        data: null,
      }
    }
  }

  @Post('generate-recipe')
  async generateRecipe(@Body() body: any) {
    try {
      const result = await this.aiService.generateRecipeList(body)
      return { code: 0, message: 'ok', data: result }
    } catch (error: any) {
      return {
        code: 10021,
        message: error?.message || '菜谱生成失败',
        data: null,
      }
    }
  }

  @Post('recognize-audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AUDIO_SIZE },
    }),
  )
  async recognizeAudio(@UploadedFile() file: any) {
    if (!file) {
      return { code: 10041, message: '语音文件为空', data: null }
    }
    const mime = `${file.mimetype || ''}`.toLowerCase()
    const name = `${file.originalname || ''}`.toLowerCase()
    const extOk = ALLOWED_AUDIO_EXT.some((ext) => name.endsWith(ext))
    if (!ALLOWED_AUDIO_TYPES.has(mime) && !extOk && mime !== 'application/octet-stream') {
      return { code: 10042, message: '仅支持 wav/mp3/m4a/aac/webm', data: null }
    }
    if (Number(file.size || 0) > MAX_AUDIO_SIZE) {
      return { code: 10042, message: '语音大小不能超过 12MB', data: null }
    }
    try {
      const voice = await this.aiService.recognizeTextFromAudio(file)
      return { code: 0, message: 'ok', data: voice }
    } catch (error: any) {
      return {
        code: 10043,
        message: error?.message || '语音识别失败',
        data: null,
      }
    }
  }
}
