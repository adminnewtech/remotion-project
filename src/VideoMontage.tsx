import React from 'react';
import { 
  AbsoluteFill, 
  Sequence, 
  Video, 
  interpolate, 
  useCurrentFrame
} from 'remotion';

const Videos = [
  '/1_web.mp4',
  '/2_web.mp4', 
  '/3_web.mp4',
  '/4_web.mp4',
  '/%D8%A7%D9%84%D9%86%D9%87%D8%A7%D8%A9_web.mp4',
  '/%D8%A7%D9%84%D9%87%D9%88%D9%83_web.mp4',
];

export const VideoMontage: React.FC = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Intro - Title */}
      <Sequence from={0} durationInFrames={30}>
        <AbsoluteFill style={{ 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: '#1a1a2e'
        }}>
          <div style={{ 
            color: 'white', 
            fontSize: '72px',
            fontFamily: 'Arial',
            opacity: interpolate(frame, [0, 15], [0, 1])
          }}>
            🎬 مونتاج احترافي
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Video 1 */}
      <Sequence from={30} durationInFrames={210}>
        <Video src={Videos[0]} />
      </Sequence>

      {/* Video 2 */}
      <Sequence from={240} durationInFrames={180}>
        <Video src={Videos[1]} />
      </Sequence>

      {/* Video 3 */}
      <Sequence from={420} durationInFrames={150}>
        <Video src={Videos[2]} />
      </Sequence>

      {/* Video 4 */}
      <Sequence from={570} durationInFrames={150}>
        <Video src={Videos[3]} />
      </Sequence>

      {/* Video 5 */}
      <Sequence from={720} durationInFrames={180}>
        <Video src={Videos[4]} />
      </Sequence>

      {/* Video 6 */}
      <Sequence from={900} durationInFrames={180}>
        <Video src={Videos[5]} />
      </Sequence>

      {/* Outro */}
      <Sequence from={1080} durationInFrames={60}>
        <AbsoluteFill style={{ 
          justifyContent: 'center', 
          alignItems: 'center',
          backgroundColor: '#000'
        }}>
          <div style={{ 
            color: '#ffd700', 
            fontSize: '60px',
            fontFamily: 'Arial'
          }}>
            النهاية 🎬
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
