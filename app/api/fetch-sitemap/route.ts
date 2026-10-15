import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'يرجى تقديم رابط صالح لخريطة الموقع' }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'يجب أن يبدأ الرابط بـ https:// أو http://' }, { status: 400 });
    }

    // Server-side fetch to bypass browser CORS constraints
    const response = await fetch(trimmedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TopicalGapBot/1.0; +https://topicalgap.ai)',
        'Accept': 'application/xml, text/xml, application/xhtml+xml, text/plain;q=0.9, */*;q=0.8'
      },
      next: { revalidate: 3600 } // cache for 1 hour
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `فشل جلب خريطة الموقع: خطأ السيرفر (${response.status} ${response.statusText})` },
        { status: response.status }
      );
    }

    const xmlText = await response.text();

    if (!xmlText || (!xmlText.includes('<urlset') && !xmlText.includes('<sitemapindex') && !xmlText.includes('<loc>'))) {
      return NextResponse.json(
        { error: 'المحتوى الذي تم جلبه لا يبدو كملف خريطة موقع XML قياسي (لا يحتوي على <urlset> أو <sitemapindex>).' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      url: trimmedUrl,
      xml: xmlText
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `تعذر الاتصال بالرابط: ${err.message || 'خطأ غير معروف في الاتصال'}` },
      { status: 500 }
    );
  }
}
