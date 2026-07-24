import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine } from '@fortawesome/free-solid-svg-icons';
import databricksIcon from '../assets/images/databricks_icon.svg';

interface IntroPageProps {
  onEnter: () => void;
}

// Keyframe animations
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const gradientMove = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const particleFade = keyframes`
  0% { opacity: 0; transform: translateY(20px) scale(0.8); }
  50% { opacity: 1; transform: translateY(-10px) scale(1); }
  100% { opacity: 0; transform: translateY(-40px) scale(0.6); }
`;

// Styled components
const IntroContainer = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  z-index: 1000;
  overflow: hidden;
  animation: ${fadeIn} 0.6s ease-out;
`;

const BackgroundGradient = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 30% 20%, rgba(79, 70, 229, 0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 80%, rgba(6, 182, 212, 0.06) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(79, 70, 229, 0.03) 0%, transparent 70%);
  animation: ${gradientMove} 8s ease infinite;
  background-size: 200% 200%;
`;

const Particle = styled.div<{ delay: number; left: string; size: number }>`
  position: absolute;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  border-radius: 50%;
  background: var(--color-accent);
  opacity: 0;
  left: ${({ left }) => left};
  bottom: 20%;
  animation: ${particleFade} 3s ease-in-out infinite;
  animation-delay: ${({ delay }) => delay}s;
`;

const Content = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 600px;
  padding: 40px;
`;

const LogoWrapper = styled.div<{ visible: boolean }>`
  animation: ${({ visible }) => visible ? css`${float} 3s ease-in-out infinite` : 'none'};
  opacity: ${({ visible }) => visible ? 1 : 0};
  transform: ${({ visible }) => visible ? 'translateY(0)' : 'translateY(20px)'};
  transition: opacity 0.8s ease, transform 0.8s ease;
`;

const LogoCircle = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 24px;
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20px 60px rgba(14, 87, 196, 0.35);
  animation: ${pulse} 2.5s ease-in-out infinite;
`;

const LogoImg = styled.img`
  width: 52px;
  height: 52px;
  filter: brightness(0) invert(1);
`;

const Title = styled.h1<{ visible: boolean }>`
  font-size: 42px;
  font-weight: 700;
  text-align: center;
  color: var(--text-primary);
  font-family: 'Figtree', sans-serif;
  margin: 0;
  opacity: ${({ visible }) => visible ? 1 : 0};
  transform: ${({ visible }) => visible ? 'translateY(0)' : 'translateY(30px)'};
  transition: opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s;
  
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--color-accent) 50%, var(--color-cyan) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${shimmer} 4s linear infinite;
`;

const Subtitle = styled.p<{ visible: boolean }>`
  font-size: 18px;
  line-height: 1.6;
  text-align: center;
  color: var(--text-secondary);
  font-family: 'Figtree', sans-serif;
  margin: 0;
  max-width: 480px;
  opacity: ${({ visible }) => visible ? 1 : 0};
  transform: ${({ visible }) => visible ? 'translateY(0)' : 'translateY(30px)'};
  transition: opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s;
`;

const FeaturesRow = styled.div<{ visible: boolean }>`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  opacity: ${({ visible }) => visible ? 1 : 0};
  transform: ${({ visible }) => visible ? 'translateY(0)' : 'translateY(30px)'};
  transition: opacity 0.8s ease 0.6s, transform 0.8s ease 0.6s;
`;

const FeatureChip = styled.div<{ glowColor?: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 100px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color-strong);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  font-family: 'Figtree', sans-serif;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease;
  
  &:hover {
    transform: translateY(-3px) scale(1.05);
    border-color: ${({ glowColor }) => glowColor || 'var(--color-accent)'};
    box-shadow: 0 6px 20px ${({ glowColor }) => glowColor ? glowColor + '40' : 'rgba(79, 70, 229, 0.25)'};
    background: ${({ glowColor }) => glowColor ? glowColor + '10' : 'rgba(79, 70, 229, 0.05)'};
  }
`;

const FeatureIcon = styled.span`
  font-size: 16px;
`;

const EnterButton = styled.button<{ visible: boolean }>`
  margin-top: 16px;
  padding: 16px 48px;
  border: none;
  border-radius: 100px;
  font-size: 16px;
  font-weight: 600;
  font-family: 'Figtree', sans-serif;
  color: white;
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-light) 50%, var(--color-cyan) 100%);
  background-size: 200% auto;
  cursor: pointer;
  box-shadow: 0 12px 40px rgba(79, 70, 229, 0.35);
  opacity: ${({ visible }) => visible ? 1 : 0};
  transform: ${({ visible }) => visible ? 'translateY(0)' : 'translateY(30px)'};
  transition: opacity 0.8s ease 0.8s, transform 0.8s ease 0.8s, background-position 0.4s ease, box-shadow 0.3s ease;
  
  &:hover {
    background-position: right center;
    box-shadow: 0 16px 50px rgba(79, 70, 229, 0.45);
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 8px 25px rgba(79, 70, 229, 0.3);
  }
`;

const VersionTag = styled.span<{ visible: boolean }>`
  font-size: 12px;
  color: var(--text-muted);
  font-family: 'Figtree', sans-serif;
  opacity: ${({ visible }) => visible ? 0.7 : 0};
  transition: opacity 1s ease 1s;
`;

const IntroPage: React.FC<IntroPageProps> = ({ onEnter }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <IntroContainer>
      <BackgroundGradient />
      
      {/* Floating particles */}
      <Particle delay={0} left="15%" size={6} />
      <Particle delay={0.8} left="25%" size={4} />
      <Particle delay={1.6} left="45%" size={5} />
      <Particle delay={2.2} left="65%" size={4} />
      <Particle delay={0.4} left="75%" size={6} />
      <Particle delay={1.2} left="85%" size={3} />
      
      <Content>
        <LogoWrapper visible={visible}>
          <LogoCircle>
            <LogoImg src={databricksIcon} alt="Databricks" />
          </LogoCircle>
        </LogoWrapper>
        
        <Title visible={visible}>
          SmilesGPT
        </Title>
        
        <Subtitle visible={visible}>
          Seu assistente inteligente para explorar dados de acumulo, resgates, tier, clube e muito mais.
        </Subtitle>
        
        <FeaturesRow visible={visible}>
          <FeatureChip glowColor="#4F46E5">
            <FeatureIcon><FontAwesomeIcon icon={faChartLine} /></FeatureIcon>
            Acumulo
          </FeatureChip>
          <FeatureChip glowColor="#06B6D4">
            <FeatureIcon>✈️</FeatureIcon>
            Resgates
          </FeatureChip>
          <FeatureChip glowColor="#F59E0B">
            <FeatureIcon>⭐</FeatureIcon>
            Tier
          </FeatureChip>
          <FeatureChip glowColor="#10B981">
            <FeatureIcon>💳</FeatureIcon>
            Cobranded
          </FeatureChip>
          <FeatureChip glowColor="#8B5CF6">
            <FeatureIcon>🏆</FeatureIcon>
            Clube
          </FeatureChip>
        </FeaturesRow>
        
        <EnterButton visible={visible} onClick={onEnter}>
          Iniciar Conversa
        </EnterButton>
        
        <VersionTag visible={visible}>
          Powered by Data & Analytics
        </VersionTag>
      </Content>
    </IntroContainer>
  );
};

export default IntroPage;
