import React from 'react';
import { 
  AbsoluteFill, 
  Sequence, 
  interpolate, 
  useCurrentFrame,
  spring,
  useVideoConfig,
  Easing
} from 'remotion';

const ease = (f: number, r: number = 30) => ({
  enter: interpolate(f, [0, r], [0, 1], { extrapolateLeft: 'clamp', easing: Easing.out(Easing.ease) }),
  zoom: interpolate(f, [0, r], [1.2, 1], { extrapolateLeft: 'clamp', easing: Easing.out(Easing.ease) }),
  slide: interpolate(f, [0, r], [50, 0], { extrapolateLeft: 'clamp', easing: Easing.out(Easing.ease) }),
});

export const NewtechTikTokPro: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Colors
  const colors = {
    primary: '#e94560',
    secondary: '#00d4ff',
    gold: '#ffd700',
    green: '#00ff88',
    pink: '#ff69b4',
    dark: '#0a0a15',
    darkBlue: '#1a1a2e',
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.dark }}>
      
      {/* SLIDE 1: HOOK - Bold Opening */}
      <Sequence from={0} durationInFrames={75}>
        <AbsoluteFill style={{ 
          backgroundColor: colors.darkBlue,
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          {/* Animated Background Circles */}
          <div style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            backgroundColor: colors.primary,
            opacity: 0.2,
            transform: `scale(${interpolate(frame, [0, 30, 60], [0.5, 1, 1.2])})`,
          }} />
          <div style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            backgroundColor: colors.secondary,
            opacity: 0.15,
            transform: `scale(${interpolate(frame, [0, 40], [0.3, 1])})`,
          }} />
          
          {/* Logo */}
          <div style={{
            fontSize: '90px',
            fontWeight: '900',
            color: colors.primary,
            opacity: interpolate(frame, [0, 20], [0, 1]),
            transform: `scale(${interpolate(frame, [0, 25], [0.8, 1])})`,
            fontFamily: 'Arial Black, Arial, sans-serif',
            textShadow: `0 0 60px ${colors.primary}`,
            letterSpacing: '4px',
            zIndex: 10,
          }}>
            🆕 NEWTECH
          </div>
          
          {/* Tagline */}
          <div style={{
            fontSize: '28px',
            color: 'white',
            marginTop: '25px',
            opacity: interpolate(frame, [15, 35], [0, 1]),
            transform: `translateY(${interpolate(frame, [15, 35], [30, 0])})`,
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center',
            zIndex: 10,
          }}>
            متجر الإلكترونيات الأول في الكويت
          </div>
          
          {/* Location Badge */}
          <div style={{
            fontSize: '22px',
            color: colors.secondary,
            marginTop: '20px',
            padding: '10px 25px',
            borderRadius: '25px',
            backgroundColor: 'rgba(0,212,255,0.1)',
            border: `2px solid ${colors.secondary}`,
            opacity: interpolate(frame, [30, 50], [0, 1]),
            fontFamily: 'Arial, sans-serif',
            zIndex: 10,
          }}>
            🇰🇼 التوصيل متاح لجميع المناطق
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 2: PRODUCTS SHOWCASE */}
      <Sequence from={75} durationInFrames={90}>
        <AbsoluteFill style={{ 
          backgroundColor: '#16213e',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Icons Row */}
          <div style={{
            display: 'flex',
            gap: '30px',
            opacity: interpolate(frame - 75, [0, 20], [0, 1]),
            transform: `translateY(${interpolate(frame - 75, [0, 20], [-50, 0])})`,
          }}>
            {['📱', '💻', '🎮', '⌨️', '🎧'].map((emoji, i) => (
              <div key={i} style={{
                fontSize: '70px',
                opacity: interpolate(frame - 75, [10 + i * 5, 30 + i * 5], [0, 1]),
                transform: `scale(${interpolate(frame - 75, [10 + i * 5, 25 + i * 5], [0.5, 1])})`,
              }}>
                {emoji}
              </div>
            ))}
          </div>
          
          {/* Category Text */}
          <div style={{
            fontSize: '52px',
            color: 'white',
            fontWeight: 'bold',
            marginTop: '40px',
            opacity: interpolate(frame - 75, [25, 45], [0, 1]),
            fontFamily: 'Arial Black, Arial, sans-serif',
            textAlign: 'center',
          }}>
            أجهزة إلكترونية
          </div>
          
          <div style={{
            fontSize: '38px',
            color: colors.secondary,
            marginTop: '20px',
            opacity: interpolate(frame - 75, [40, 60], [0, 1]),
            fontFamily: 'Arial, sans-serif',
            textAlign: 'center',
          }}>
            اكسسوارات & Peripheral
          </div>
          
          {/* Price Tag */}
          <div style={{
            fontSize: '28px',
            color: colors.gold,
            marginTop: '30px',
            padding: '12px 30px',
            borderRadius: '20px',
            backgroundColor: 'rgba(255,215,0,0.15)',
            opacity: interpolate(frame - 75, [55, 75], [0, 1]),
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          }}>
            🔥 أسعار خاصة this week!
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 3: TRUST BADGES */}
      <Sequence from={165} durationInFrames={90}>
        <AbsoluteFill style={{ 
          backgroundColor: '#0f3460',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Badge 1 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            opacity: interpolate(frame - 165, [0, 20], [0, 1]),
            transform: `translateX(${interpolate(frame - 165, [0, 20], [-100, 0])})`,
          }}>
            <div style={{ fontSize: '60px' }}>✅</div>
            <div style={{
              fontSize: '42px',
              color: colors.green,
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}>منتجات أصلية 100%</div>
          </div>
          
          {/* Badge 2 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '35px',
            opacity: interpolate(frame - 165, [20, 40], [0, 1]),
            transform: `translateX(${interpolate(frame - 165, [20, 40], [100, 0])})`,
          }}>
            <div style={{ fontSize: '60px' }}>💰</div>
            <div style={{
              fontSize: '42px',
              color: colors.gold,
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}>أسعار منافسة جداً</div>
          </div>
          
          {/* Badge 3 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '35px',
            opacity: interpolate(frame - 165, [40, 60], [0, 1]),
            transform: `translateX(${interpolate(frame - 165, [40, 60], [-100, 0])})`,
          }}>
            <div style={{ fontSize: '60px' }}>🛡️</div>
            <div style={{
              fontSize: '42px',
              color: colors.secondary,
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}>تسوق بأمان تام</div>
          </div>
          
          {/* Badge 4 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '35px',
            opacity: interpolate(frame - 165, [60, 80], [0, 1]),
            transform: `translateX(${interpolate(frame - 165, [60, 80], [100, 0])})`,
          }}>
            <div style={{ fontSize: '60px' }}>🚚</div>
            <div style={{
              fontSize: '42px',
              color: colors.pink,
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif'
            }}>توصيل سريع</div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 4: APP DOWNLOAD */}
      <Sequence from={255} durationInFrames={90}>
        <AbsoluteFill style={{ 
          backgroundColor: colors.darkBlue,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Phone Icon */}
          <div style={{
            fontSize: '100px',
            opacity: interpolate(frame - 255, [0, 20], [0, 1]),
            transform: `scale(${interpolate(frame - 255, [0, 25], [0.5, 1])})`,
          }}>
            📲
          </div>
          
          {/* Main Text */}
          <div style={{
            fontSize: '50px',
            color: 'white',
            fontWeight: 'bold',
            marginTop: '30px',
            opacity: interpolate(frame - 255, [15, 35], [0, 1]),
            fontFamily: 'Arial Black, Arial, sans-serif',
            textAlign: 'center',
          }}>
            حمّل التطبيق الآن!
          </div>
          
          {/* Store Buttons */}
          <div style={{
            display: 'flex',
            gap: '30px',
            marginTop: '40px',
            opacity: interpolate(frame - 255, [30, 50], [0, 1]),
          }}>
            <div style={{
              fontSize: '28px',
              color: 'white',
              padding: '15px 30px',
              borderRadius: '15px',
              backgroundColor: colors.secondary,
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif',
            }}>
              Google Play 📱
            </div>
            <div style={{
              fontSize: '28px',
              color: 'white',
              padding: '15px 30px',
              borderRadius: '15px',
              backgroundColor: 'black',
              border: '2px solid white',
              fontWeight: 'bold',
              fontFamily: 'Arial, sans-serif',
            }}>
              App Store 📱
            </div>
          </div>
          
          {/* Exclusive Offer */}
          <div style={{
            fontSize: '32px',
            color: colors.gold,
            marginTop: '40px',
            padding: '15px 40px',
            borderRadius: '25px',
            backgroundColor: 'rgba(255,215,0,0.15)',
            opacity: interpolate(frame - 255, [50, 70], [0, 1]),
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          }}>
            🔥 عروض حصرية داخل التطبيق!
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SLIDE 5: FINAL CTA */}
      <Sequence from={345} durationInFrames={60}>
        <AbsoluteFill style={{ 
          backgroundColor: colors.dark,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {/* Glow Effect */}
          <div style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            backgroundColor: colors.primary,
            opacity: 0.15,
            filter: 'blur(80px)',
            transform: `scale(${interpolate(frame - 345, [0, 30], [0.5, 1.2])})`,
          }} />
          
          {/* Website */}
          <div style={{
            fontSize: '65px',
            color: colors.primary,
            fontWeight: '900',
            opacity: interpolate(frame - 345, [0, 20], [0, 1]),
            transform: `scale(${interpolate(frame - 345, [0, 20], [0.8, 1])})`,
            fontFamily: 'Arial Black, Arial, sans-serif',
            textShadow: `0 0 50px ${colors.primary}`,
            zIndex: 10,
          }}>
            🌐 newtechq8.com
          </div>
          
          {/* Location */}
          <div style={{
            fontSize: '35px',
            color: 'white',
            marginTop: '25px',
            opacity: interpolate(frame - 345, [15, 35], [0, 1]),
            fontFamily: 'Arial, sans-serif',
            zIndex: 10,
          }}>
            🇰🇼 Kuwait
          </div>
          
          {/* CTA */}
          <div style={{
            fontSize: '40px',
            color: colors.gold,
            marginTop: '35px',
            fontWeight: 'bold',
            opacity: interpolate(frame - 345, [25, 45], [0, 1]),
            fontFamily: 'Arial Black, Arial, sans-serif',
            zIndex: 10,
          }}>
            ⬇️ زورنا الآن ⬇️
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
