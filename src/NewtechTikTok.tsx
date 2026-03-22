import React from 'react';
import { 
  AbsoluteFill, 
  Sequence, 
  interpolate, 
  useCurrentFrame,
  spring,
  useVideoConfig,
  Img,
  Video
} from 'remotion';

const FRAME_RATE = 30;

export const NewtechTikTok: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Animation helpers
  const fadeIn = (startFrame: number, duration: number = 30) => 
    interpolate(frame, [startFrame, startFrame + duration], [0, 1]);
  
  const slideIn = (startFrame: number, direction: 'left' | 'right' | 'up' = 'up') => {
    const offset = interpolate(frame, [startFrame, startFrame + 20], [100, 0]);
    if (direction === 'left') return { x: offset, y: 0 };
    if (direction === 'right') return { x: -offset, y: 0 };
    return { x: 0, y: offset };
  };
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a15' }}>
      
      {/* SLIDE 1: INTRO - Logo */}
      <Sequence from={0} durationInFrames={60}>
        <AbsoluteFill style={{ 
          backgroundColor: '#1a1a2e',
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '80px',
            fontWeight: 'bold',
            color: '#e94560',
            opacity: fadeIn(0, 20),
            transform: `translateY(${-slideIn(0, 'up').y}px)`,
            fontFamily: 'Arial Black, Arial, sans-serif',
            textShadow: '0 0 30px rgba(233,69,96,0.5)',
            letterSpacing: '8px'
          }}>
            🆕 NEWTECH
          </div>
          <div style={{
            fontSize: '32px',
            color: 'white',
            marginTop: '20px',
            opacity: fadeIn(15, 25),
            fontFamily: 'Arial, sans-serif'
          }}>
            متجر الإلكترونيات الأول في الكويت
          </div>
          <div style={{
            fontSize: '24px',
            color: '#00d4ff',
            marginTop: '30px',
            opacity: fadeIn(30, 20),
            fontFamily: 'Arial, sans-serif'
          }}>
            🇰🇼 توصيل لجميع المناطق
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 2: CATEGORIES */}
      <Sequence from={60} durationInFrames={90}>
        <AbsoluteFill style={{ 
          backgroundColor: '#16213e',
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '60px',
            color: '#ffd700',
            opacity: fadeIn(0, 15),
            fontFamily: 'Arial Black, Arial, sans-serif'
          }}>
            📱 💻 🎮
          </div>
          <div style={{
            fontSize: '48px',
            color: 'white',
            fontWeight: 'bold',
            marginTop: '30px',
            opacity: fadeIn(10, 20),
            fontFamily: 'Arial, sans-serif'
          }}>
            أجهزة إلكترونية
          </div>
          <div style={{
            fontSize: '36px',
            color: '#00d4ff',
            marginTop: '20px',
            opacity: fadeIn(20, 20),
            fontFamily: 'Arial, sans-serif'
          }}>
            اكسسوارات & Peripheral
          </div>
          <div style={{
            fontSize: '32px',
            color: '#e94560',
            marginTop: '30px',
            opacity: fadeIn(35, 20),
            fontFamily: 'Arial, sans-serif'
          }}>
            🎧 📱 ⌨️
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 3: FEATURES */}
      <Sequence from={150} durationInFrames={90}>
        <AbsoluteFill style={{ 
          backgroundColor: '#0f3460',
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '44px',
            color: '#00ff00',
            fontWeight: 'bold',
            marginBottom: '40px',
            opacity: fadeIn(0, 15),
            fontFamily: 'Arial, sans-serif'
          }}>
            ✅ منتجات أصلية 100%
          </div>
          <div style={{
            fontSize: '44px',
            color: '#ffd700',
            fontWeight: 'bold',
            marginBottom: '40px',
            opacity: fadeIn(15, 15),
            fontFamily: 'Arial, sans-serif'
          }}>
            💰 أسعار منافسة جداً
          </div>
          <div style={{
            fontSize: '44px',
            color: '#00d4ff',
            fontWeight: 'bold',
            marginBottom: '40px',
            opacity: fadeIn(30, 15),
            fontFamily: 'Arial, sans-serif'
          }}>
            🛡️ تسوق بأمان تام
          </div>
          <div style={{
            fontSize: '44px',
            color: '#ff69b4',
            fontWeight: 'bold',
            opacity: fadeIn(45, 15),
            fontFamily: 'Arial, sans-serif'
          }}>
            🚚 توصيل سريع
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 4: APP PROMO */}
      <Sequence from={240} durationInFrames={90}>
        <AbsoluteFill style={{ 
          backgroundColor: '#1a1a2e',
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '56px',
            color: 'white',
            fontWeight: 'bold',
            marginBottom: '50px',
            opacity: fadeIn(0, 15),
            fontFamily: 'Arial, sans-serif'
          }}>
            📲 حمّل التطبيق الآن!
          </div>
          <div style={{
            display: 'flex',
            gap: '40px',
            opacity: fadeIn(20, 20)
          }}>
            <div style={{
              fontSize: '40px',
              color: '#00d4ff',
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}>
              Google Play 📱
            </div>
            <div style={{
              fontSize: '40px',
              color: '#e94560',
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}>
              App Store 📱
            </div>
          </div>
          <div style={{
            fontSize: '36px',
            color: '#ffd700',
            marginTop: '60px',
            fontWeight: 'bold',
            opacity: fadeIn(45, 20),
            fontFamily: 'Arial, sans-serif'
          }}>
            🔥 عروض حصرية داخل التطبيق!
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 5: FINAL CTA */}
      <Sequence from={330} durationInFrames={60}>
        <AbsoluteFill style={{ 
          backgroundColor: '#0a0a15',
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '72px',
            color: '#e94560',
            fontWeight: 'bold',
            opacity: fadeIn(0, 15),
            fontFamily: 'Arial Black, Arial, sans-serif',
            textShadow: '0 0 40px rgba(233,69,96,0.6)'
          }}>
            🌐 newtechq8.com
          </div>
          <div style={{
            fontSize: '40px',
            color: 'white',
            marginTop: '40px',
            opacity: fadeIn(20, 15),
            fontFamily: 'Arial, sans-serif'
          }}>
            🇰🇼 Kuwait
          </div>
          <div style={{
            fontSize: '48px',
            color: '#ffd700',
            marginTop: '50px',
            fontWeight: 'bold',
            opacity: fadeIn(35, 15),
            fontFamily: 'Arial, sans-serif'
          }}>
            ⬇️ زورنا الآن ⬇️
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
