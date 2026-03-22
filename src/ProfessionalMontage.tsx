import React from 'react';
import { 
  AbsoluteFill, 
  Sequence, 
  interpolate, 
  useCurrentFrame,
  useVideoConfig,
  Video,
  spring,
  Easing
} from 'remotion';

const CLIPS = [
  { name: 'Clip 1', duration: 7 },
  { name: 'Clip 2', duration: 6 },
  { name: 'Clip 3', duration: 4 },
  { name: 'Clip 4', duration: 4 },
  { name: 'Clip 5', duration: 5 },
  { name: 'Clip 6', duration: 5 },
];

const BASE = '/root/remotion-project/videos';

export const ProfessionalMontage: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Animation helpers
  const fadeIn = (start: number, dur: number = 20) => 
    interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp' });
  
  const fadeOut = (end: number, dur: number = 20) => 
    interpolate(frame, [end - dur, end], [1, 0], { extrapolateLeft: 'clamp' });
  
  const zoomEffect = (start: number, peak: number = 25, dur: number = 50) => {
    const zoomIn = interpolate(frame, [start, start + peak], [1, 1.3], { extrapolateLeft: 'clamp', easing: Easing.out(Easing.ease) });
    const zoomOut = interpolate(frame, [start + peak, start + dur], [1.3, 1], { extrapolateLeft: 'clamp', easing: Easing.in(Easing.ease) });
    return frame < start + peak ? zoomIn : zoomOut;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      
      {/* INTRO - Title Slide */}
      <Sequence from={0} durationInFrames={60}>
        <AbsoluteFill style={{ 
          backgroundColor: '#0a0a15',
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          {/* Animated gradient background */}
          <div style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            backgroundColor: '#e94560',
            opacity: 0.15,
            filter: 'blur(100px)',
            transform: `scale(${interpolate(frame, [0, 40], [0.5, 1.5])})`,
          }} />
          
          <div style={{
            fontSize: '80px',
            fontWeight: '900',
            color: '#e94560',
            opacity: fadeIn(0, 25),
            fontFamily: 'Arial Black, Arial, sans-serif',
            textShadow: '0 0 60px rgba(233,69,96,0.6)',
            zIndex: 10,
            letterSpacing: '6px',
          }}>
            🎬 MONTAJE PRO
          </div>
          
          <div style={{
            fontSize: '28px',
            color: 'white',
            marginTop: '20px',
            opacity: fadeIn(15, 25),
            fontFamily: 'Arial, sans-serif',
            zIndex: 10,
          }}>
            Video Production Professional
          </div>
          
          <div style={{
            fontSize: '24px',
            color: '#00d4ff',
            marginTop: '30px',
            padding: '12px 30px',
            borderRadius: '30px',
            border: '2px solid #00d4ff',
            opacity: fadeIn(30, 20),
            fontFamily: 'Arial, sans-serif',
            zIndex: 10,
          }}>
            🎥 4K Quality
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CLIP 1 - with zoom effect */}
      <Sequence from={60} durationInFrames={210}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            transform: `scale(${zoomEffect(0, 30, 60)})`,
            opacity: fadeOut(200, 20),
          }}>
            <Video 
              src={`${BASE}/1_web.mp4`}
              style={{
                width: '1080px',
                height: '1920px',
              }}
            />
          </div>
          {/* Overlay badge */}
          <div style={{
            position: 'absolute',
            bottom: '100px',
            left: '30px',
            fontSize: '24px',
            color: 'white',
            padding: '8px 20px',
            backgroundColor: 'rgba(233,69,96,0.8)',
            borderRadius: '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            opacity: fadeIn(150, 15),
          }}>
            📹 Scene 1
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CLIP 2 - with slide effect */}
      <Sequence from={270} durationInFrames={180}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            transform: `translateX(${interpolate(frame - 270, [0, 30], [-50, 0])})`,
            opacity: fadeOut(440, 20),
          }}>
            <Video 
              src={`${BASE}/2_web.mp4`}
              style={{
                width: '1080px',
                height: '1920px',
              }}
            />
          </div>
          <div style={{
            position: 'absolute',
            bottom: '100px',
            right: '30px',
            fontSize: '24px',
            color: 'white',
            padding: '8px 20px',
            backgroundColor: 'rgba(0,212,255,0.8)',
            borderRadius: '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            opacity: fadeIn(130, 15),
          }}>
            📹 Scene 2
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CLIP 3 - with fade */}
      <Sequence from={450} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            opacity: interpolate(frame - 450, [0, 20, 130, 150], [0, 1, 1, 0]),
          }}>
            <Video 
              src={`${BASE}/3_web.mp4`}
              style={{
                width: '1080px',
                height: '1920px',
              }}
            />
          </div>
          <div style={{
            position: 'absolute',
            top: '100px',
            left: '30px',
            fontSize: '24px',
            color: 'white',
            padding: '8px 20px',
            backgroundColor: 'rgba(255,215,0,0.8)',
            borderRadius: '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          }}>
            📹 Scene 3
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CLIP 4 */}
      <Sequence from={600} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Video 
            src={`${BASE}/4_web.mp4`}
            style={{
              width: '1080px',
              height: '1920px',
              opacity: fadeOut(740, 20),
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '100px',
            left: '30px',
            fontSize: '24px',
            color: 'white',
            padding: '8px 20px',
            backgroundColor: 'rgba(0,255,136,0.8)',
            borderRadius: '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          }}>
            📹 Scene 4
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CLIP 5 - النهاية */}
      <Sequence from={750} durationInFrames={180}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            transform: `scale(${interpolate(frame - 750, [0, 40], [0.9, 1.1])})`,
            opacity: fadeOut(920, 20),
          }}>
            <Video 
              src={`${BASE}/النهايه_web.mp4`}
              style={{
                width: '1080px',
                height: '1920px',
              }}
            />
          </div>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '60px',
            color: '#ffd700',
            fontWeight: 'bold',
            fontFamily: 'Arial Black, Arial, sans-serif',
            textShadow: '0 0 40px rgba(255,215,0,0.8)',
            opacity: fadeIn(100, 20),
          }}>
            🎬
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* CLIP 6 - الهوك */}
      <Sequence from={930} durationInFrames={150}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Video 
            src={`${BASE}/الهوك_web.mp4`}
            style={{
              width: '1080px',
              height: '1920px',
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '100px',
            right: '30px',
            fontSize: '24px',
            color: 'white',
            padding: '8px 20px',
            backgroundColor: 'rgba(255,105,180,0.8)',
            borderRadius: '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          }}>
            🎯 Final Scene
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* OUTRO - Credits */}
      <Sequence from={1080} durationInFrames={90}>
        <AbsoluteFill style={{ 
          backgroundColor: '#0a0a15',
          justifyContent: 'center', 
          alignItems: 'center'
        }}>
          <div style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            backgroundColor: '#00d4ff',
            opacity: 0.1,
            filter: 'blur(100px)',
            transform: `scale(${interpolate(frame - 1080, [0, 50], [0.5, 1.5])})`,
          }} />
          
          <div style={{
            fontSize: '60px',
            color: '#ffd700',
            fontWeight: 'bold',
            fontFamily: 'Arial Black, Arial, sans-serif',
            opacity: fadeIn(0, 20),
            textShadow: '0 0 40px rgba(255,215,0,0.6)',
            zIndex: 10,
          }}>
            🎉 النهاية
          </div>
          
          <div style={{
            fontSize: '36px',
            color: 'white',
            marginTop: '30px',
            fontFamily: 'Arial, sans-serif',
            opacity: fadeIn(25, 20),
            zIndex: 10,
          }}>
            شكراً للمشاهدة!
          </div>
          
          <div style={{
            display: 'flex',
            gap: '20px',
            marginTop: '50px',
            opacity: fadeIn(45, 20),
            zIndex: 10,
          }}>
            <div style={{
              fontSize: '24px',
              color: 'white',
              padding: '10px 25px',
              borderRadius: '25px',
              backgroundColor: 'rgba(233,69,96,0.3)',
              border: '2px solid #e94560',
              fontFamily: 'Arial, sans-serif',
            }}>
              🔄 Share
            </div>
            <div style={{
              fontSize: '24px',
              color: 'white',
              padding: '10px 25px',
              borderRadius: '25px',
              backgroundColor: 'rgba(0,212,255,0.3)',
              border: '2px solid #00d4ff',
              fontFamily: 'Arial, sans-serif',
            }}>
              ❤️ Subscribe
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};
