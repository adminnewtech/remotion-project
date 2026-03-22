import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { ProfessionalMontage } from './ProfessionalMontage';

const RemotionComposition = () => {
  return (
    <Composition
      id="ProfessionalMontage"
      component={ProfessionalMontage}
      durationInFrames={1170} // 39 seconds
      fps={30}
      width={1080}
      height={1920}
    />
  );
};

registerRoot(RemotionComposition);
