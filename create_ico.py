from PIL import Image
import os

def create_high_quality_ico():
    try:
        # PNG 파일 열기
        img = Image.open('assets/icon.png')
        
        # 512x512 포함한 더 많은 크기와 고화질 설정으로 ICO 파일 생성
        sizes = [
            (16, 16), (24, 24), (32, 32), (48, 48), 
            (64, 64), (96, 96), (128, 128), (256, 256), (512, 512)
        ]
        images = []
        
        for size in sizes:
            # 고화질 리사이징 (LANCZOS는 가장 고화질)
            resized_img = img.resize(size, Image.Resampling.LANCZOS)
            
            # 알파 채널이 있는 경우 유지, 없는 경우 RGB로 변환
            if resized_img.mode in ('RGBA', 'LA'):
                # 알파 채널 유지
                pass
            else:
                # RGB로 변환
                resized_img = resized_img.convert('RGB')
            
            images.append(resized_img)
        
        # 고화질 ICO 파일로 저장 (512x512 포함)
        images[0].save('assets/icon.ico', format='ICO', sizes=[(img.width, img.height) for img in images], quality=95)
        
        print(f"✅ 고화질 ICO 파일이 성공적으로 생성되었습니다: assets/icon.ico")
        print(f"📏 원본 이미지 크기: {img.size}")
        print(f"🎨 생성된 크기들: {[img.size for img in images]}")
        print(f"🔍 512x512 크기가 포함되어 더 고화질입니다!")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        # JPEG 파일인 경우 처리
        try:
            img = Image.open('assets/icon.png')
            # JPEG를 고화질로 변환 후 ICO 생성
            rgb_img = img.convert('RGB')
            
            # 512x512 포함한 크기들
            sizes = [
                (16, 16), (24, 24), (32, 32), (48, 48), 
                (64, 64), (96, 96), (128, 128), (256, 256), (512, 512)
            ]
            images = []
            
            for size in sizes:
                # 고화질 리사이징
                resized_img = rgb_img.resize(size, Image.Resampling.LANCZOS)
                images.append(resized_img)
            
            # 고화질 ICO 파일로 저장 (512x512 포함)
            images[0].save('assets/icon.ico', format='ICO', sizes=[(img.width, img.height) for img in images], quality=95)
            
            print(f"✅ 고화질 ICO 파일이 성공적으로 생성되었습니다: assets/icon.ico")
            print(f"📏 원본 이미지 크기: {img.size}")
            print(f"🎨 생성된 크기들: {[img.size for img in images]}")
            print(f"🔍 512x512 크기가 포함되어 더 고화질입니다!")
            
        except Exception as e2:
            print(f"❌ JPEG 변환 중 오류 발생: {e2}")

if __name__ == "__main__":
    create_high_quality_ico()
