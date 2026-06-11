# HUHU House Guest Guide

HUHU 하우스 게스트를 위한 모바일 우선 정적 가이드북입니다.

## GitHub Pages 배포

1. 이 저장소를 GitHub에 push합니다.
2. GitHub 저장소의 `Settings` > `Pages`로 이동합니다.
3. `Deploy from a branch`를 선택하고 `main` 브랜치의 root 폴더를 지정합니다.
4. 배포 URL에서 `index.html`이 바로 열립니다.

별도 빌드 과정이 없어서 GitHub Pages에 그대로 올릴 수 있습니다.

## 현지 가이드 스팟 추가

가게는 `spots/*.md` 파일로 관리합니다. 블로그 글을 하나 쓰듯이 파일을 추가하고, `spots/index.json`에 파일명을 넣으면 가이드 메뉴에 자동으로 표시됩니다.

1. `spots/sample.md`처럼 새 파일을 만듭니다.
2. 파일 맨 위의 `---` 영역에 제목, 카테고리, 평점, 이미지, 팁을 적습니다.
3. 본문 첫 문단은 카드 설명으로 사용됩니다.
4. `spots/index.json` 배열에 새 파일명을 추가합니다.

예시:

```md
---
title: 새 카페 이름
category: cafe
rating: 4.8
image: images/new-cafe.jpg
distance: 도보 7분
hours: 오전 방문 추천
price: 커피 5천원대
tip: 창가 자리가 좋아요.
---

후암동 산책 후 잠깐 쉬기 좋은 조용한 카페입니다.

두 번째 문단부터는 나중에 상세 페이지로 확장할 때 사용할 수 있습니다.
```

카테고리는 `food`, `cafe`, `night` 중 하나를 사용합니다. 이미지는 직접 올린 파일이면 `images/new-cafe.jpg`처럼 쓰고, 기존 기본 이미지를 쓰려면 `image` 대신 `imageClass: restaurant`, `imageClass: cafe`, `imageClass: music` 중 하나를 사용하면 됩니다.

## 네이버 지도 연동

`Guide` 화면은 네이버 지도와 Supabase Edge Function을 사용할 수 있게 준비되어 있습니다.

### 1. 지도/함수 키 설정

`index.html`의 `naverGuideConfig`에 값을 넣습니다.

```js
const naverGuideConfig = {
  ncpKeyId: "네이버 클라우드 Maps JavaScript API 키",
  supabaseAnonKey: "Supabase anon 또는 publishable key",
  placeLookupUrl: "https://afpxwroypxoidmpmcang.supabase.co/functions/v1/naver-place-lookup",
};
```

`ncpKeyId`는 네이버 클라우드 콘솔에서 발급하고, 배포 도메인을 네이버 지도 API 허용 도메인에 등록해야 합니다. `supabaseAnonKey`는 브라우저에 공개 가능한 키이며, Edge Function은 JWT 검증이 켜진 상태로 배포되어 있습니다.

### 2. 매장 ID만으로 추가

새 매장은 아래처럼 네이버 매장 ID만 넣어도 됩니다.

```md
---
naverPlaceId: 1234567890
category: cafe
---
```

`category`는 필터용이라 가능하면 함께 넣는 것을 추천합니다. `food`, `cafe`, `night` 중 하나를 사용하세요.

네이버 매장 ID 조회는 공식 Place Detail API가 아니라 Supabase Edge Function에서 네이버 플레이스 공개 페이지를 해석하는 방식입니다. 네이버 응답 구조가 바뀌면 좌표 조회가 실패할 수 있으며, 실패한 매장은 카드에는 남지만 지도 핀은 표시되지 않습니다. 안정적으로 운영하려면 필요한 매장은 `lat`, `lng`, `title`, `roadAddress`를 직접 보정해 둘 수 있습니다.
