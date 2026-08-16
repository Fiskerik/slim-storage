Pod::Spec.new do |s|
  s.name = 'ExpoPhotoIntelligence'
  s.version = '1.1.3'
  s.summary = 'On-device PhotoKit and Vision analysis for Trimswipe.'
  s.description = 'Local Vision feature-print, face-quality, and aesthetics signals.'
  s.author = 'Trimswipe'
  s.homepage = 'https://trimswipe.app'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '15.0' }
  s.source = { :git => 'https://github.com/expo/expo.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Photos', 'Vision', 'UIKit', 'ImageIO'
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
end
