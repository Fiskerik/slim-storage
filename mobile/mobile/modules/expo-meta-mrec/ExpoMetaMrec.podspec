Pod::Spec.new do |s|
  s.name = 'ExpoMetaMrec'
  s.version = '1.1.5'
  s.summary = 'Direct Meta Audience Network MREC view for TrimSwipe.'
  s.description = 'An Expo native view that loads a 300x250 Meta Audience Network placement without LevelPlay mediation.'
  s.author = 'TrimSwipe'
  s.homepage = 'https://trimswipe.app'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '15.0' }
  s.source = { :git => 'https://github.com/expo/expo.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'FBAudienceNetwork', '6.22.0'
  s.frameworks = 'UIKit'
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
end
