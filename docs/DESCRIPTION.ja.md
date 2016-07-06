inverseBoundingBox算出処理概要
==============

# inverseBoundingBoxについて

ProjAEQDクラスのinverseBoundingBox(x1,y1,x2,y2)メソッドは、正距方位図法で投影され描画された地図上の矩形(x1,y1)-(x2,y2)を緯度経度座標系に変換した図形を包含する矩形を計算するメソッドである。

![図a. inverseBoundingBoxのイメージ](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/inverse-bounding-box.png)
図a. inverseBoundingBoxのイメージ

図aにおいて、左上の画像は正距方位図法に投影された地図であり、その地図の座標系上の赤色の矩形を緯度経度座標系上に変換した図形が右下の紫色の図形となる。
これを包含する緯度経度座標系上の矩形（緑色の矩形）がinverseBoundingBoxとなる。

この処理は描画やサーバから取得するべき緯度経度座標系上のタイル画像を決定するために必要となる。


以下で正距方位図法(Azimuthal Equidistant Projection)の場合でのinverseBoundingBoxの計算方法を示す。
正距方位図法以外の多くの投影変換でも同様の考え方が適用できるものと考えられる。


***

# 正距方位図法でのinverseBoundingBoxの計算方法

## 導入

本ライブラリで使用する投影前のタイル画像の座標系は緯度経度座標系（通常はEPSG:4326）である。
このタイル画像を本ライブラリの処理によって正距方位図法へ投影して画面上に表示する。
この投影後の座標系は(x,y)の座標値で表される2次元の直交座標系となる。
この投影後の座標系を以後「（投影後の）XY座標系」と呼ぶものとする。


投影前のタイル画像の座標系である緯度経度座標系は経度、緯度(λ,ψ)の2個の座標値で表されるが、これは2次元の球面に対応する。
2次元直交座標系とは、緯度±90度に対応する座標は経度によらず同一点を示し、また経度方向に周期性を持つという違いがある。

従って投影後のXY座標系から緯度経度座標系への図形の逆変換は、2次元の直交座標系から2次元の球面上の座標系への変換に相当する。


この図形の変換は大きく分けて以下の3パターンに分類できる。  

1. 投影後のXY座標系上の矩形が北極あるいは南極と交差する場合  
2. 投影後のXY座標系上の矩形が経度±180度の線分と交差する場合で、1に該当しない場合  
3. 一般的な場合、すなわち1,2のどちらにも該当しない場合  

なお、以降では投影中心の経度は0度として説明する。
中心の経度が0度以外の値の場合はその分だけシフトすれば同じ議論が成り立つため、経度を0度としても一般性は失わない。


### 1. 投影後のXY座標系上の矩形が北極あるいは南極を交差する場合

![図1-1. 投影後のXY座標系上の北極を中心とした矩形の例](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/1-north-pole-proj.png)
図1-1. 投影後のXY座標系上の北極を中心とした矩形の例（投影中心 緯度+90度、経度0度）

![図1-2. 北極を中心とした矩形の緯度経度座標系上でのジオメトリ](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/1-north-pole-latlong.png)
図1-2. 北極を中心とした矩形の緯度経度座標系上でのジオメトリ

例えば図1-1のように投影後のXY座標系上の矩形が北極を含む場合、その矩形に対応するinverseBoundingBoxは (-180度, λ_L) - (+180度, +90度)となる（図1-2を参照）。

同様に南極を含む場合はinverseBoundingBoxは (-180度, -90度) - (+180度, λ_U) となる。

これは[https://www.jasondavies.com/maps/bounds/](https://www.jasondavies.com/maps/bounds/)にも同様の説明がある。


### 2. 投影後のXY座標系上の矩形が経度±180度の線分と交差する場合で、両極とは交差しない場合

![図2-1. 投影後のXY座標系上の子午線と交差する矩形の例](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/2-cross-meridian-proj.png)
図2-1. 投影後のXY座標系上の子午線と交差する矩形の例（投影中心 緯度+30度、経度0度）

![図2-2. 子午線と交差する矩形の緯度経度座標系上でのジオメトリ](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/2-cross-meridian-latlong.png)
図2-2. 子午線と交差する矩形の緯度経度座標系上でのジオメトリ

この場合、経度の範囲を-180度〜+180度で扱ってしまうとinverseBoundingBoxは経度±180度線で分割された矩形となる。
これは図2-2のように緯度経度座標系の経度の範囲を0度〜+360度で取り扱うようにすることで図形が連結となり、扱いが容易となる。


### 3. 一般的な場合

![図3-1. 投影後のXY座標系上の矩形の例](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/3-general-case-proj.png)
図3-1. 投影後のXY座標系上の矩形の例（投影中心 緯度+30度、経度0度）

![図3-2. 矩形を緯度経度座標系上へ投影したジオメトリ](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/3-general-case-latlong.png)
図3-2. 矩形を緯度経度座標系上へ投影したジオメトリ

![図3-3. 矩形を緯度経度座標系上へ投影したジオメトリ（拡大版）](https://raw.githubusercontent.com/tomosn/raster-map-projection/master/docs/3-general-case-latlong-zoom.png)
図3-3. 矩形を緯度経度座標系上へ投影したジオメトリ（拡大版）

1,2のどちらにも該当しない一般的な場合は、2次元の直交座標系上の矩形から別の2次元の直交座標系上の図形に投影変換し、その図形を包含する矩形を求める問題に帰着できる。


### 投影中心の緯度が±90度の場合

2のパターンが存在しない。それ以外は中心の緯度が±90度以外のケースと同様となる。


***

## 通常の場合のinverseBoundingBoxの計算方法の詳細

3の一般的な場合でのinverseBoundingBoxの計算方法の詳細について説明する。
なお、それ以外のパターンは3の一般的な場合での計算の簡単な変形となる。

TBD




----
Copyright (C) 2016 T.Seno
