// GET /api/admin/shot?key=付款记录/<用户名>/<时间戳>/付款截图.<ext>
// 管理员专用：付款截图原来只进不出，后台核对付款时看不到图；这里把对象存储里的原始字节直接吐回去。
// 返回原始字节而不是 base64 包成 JSON——省掉编码与 JSON 序列化的 CPU（免费版每请求只有 10ms）。
// 前端用带 Authorization 头的 XHR 取回后转 blob 地址显示，token 不进 URL。
import { json } from '../../_lib/http.js';
import { currentAdmin } from '../../_lib/auth.js';

// 只允许读截图目录，避免这个接口变成「任意读 KV」的口子。
const SHOT_PREFIX = '付款记录/';
const MAX_KEY_LENGTH = 512;
// KV metadata.contentType / R2 httpMetadata.contentType 都缺时按 jpg 兜底。
const DEFAULT_TYPE = 'image/jpeg';

function queryKey(request) {
  try {
    return String(new URL(request.url).searchParams.get('key') || '');
  } catch (e) {
    return '';
  }
}

// 形状校验：必须 付款记录/ 开头、不含 .. 与反斜杠、不超过 KV key 上限。
function safeKey(key) {
  if (!key || key.length > MAX_KEY_LENGTH) return '';
  if (key.indexOf(SHOT_PREFIX) !== 0) return '';
  if (key.indexOf('..') >= 0) return '';
  if (key.indexOf('\\') >= 0) return '';
  return key;
}

// KV 命名空间有 getWithMetadata，R2 桶没有——用它区分该读哪种元数据字段。
function isKvNamespace(store) {
  return typeof store.getWithMetadata === 'function';
}

export async function onRequestGet({ request, env }) {
  const admin = await currentAdmin(request, null, env);
  if (!admin) return json({ success: false, msg: '无权限' }, 403);

  const key = safeKey(queryKey(request));
  if (!key) return json({ success: false, msg: '截图地址不合法' }, 400);

  // 与下单接口同样的绑定优先级：SHOTS（KV）优先，R2 兼容；一个都没绑就别让前端猜。
  const store = env.SHOTS || env.BUCKET;
  if (!store) return json({ success: false, msg: '截图存储未配置（缺 SHOTS / BUCKET 绑定）' }, 500);

  let bytes = null;
  let contentType = '';
  try {
    if (isKvNamespace(store)) {
      const got = await store.getWithMetadata(key, { type: 'arrayBuffer' });
      if (got && got.value) {
        bytes = got.value;
        contentType = (got.metadata && got.metadata.contentType) || '';
      }
    } else {
      const got = await store.get(key);
      if (got) {
        bytes = await got.arrayBuffer();
        contentType = (got.httpMetadata && got.httpMetadata.contentType) || '';
      }
    }
  } catch (e) {
    // 绑定异常/读失败也要是可读 JSON，否则前端只能笼统报「网络错误」。
    return json({ success: false, msg: '截图读取失败：' + ((e && e.message) || e) }, 500);
  }

  if (!bytes) return json({ success: false, msg: '截图不存在或已过期（截图只保留 30 天）' }, 404);

  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': contentType || DEFAULT_TYPE,
      'content-length': String(bytes.byteLength),
      // 付款截图是隐私内容：不进边缘缓存，也不落浏览器磁盘缓存。
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}